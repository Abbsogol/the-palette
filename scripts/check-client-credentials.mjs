import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testEnv } from '../tests/helpers/test-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = process.argv.includes('--mobile');
const output = resolve(root, `scripts/output/credential-check${mobile?'-mobile':''}`);
const names = ['SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','CRON_SECRET',
  'RESEND_API_KEY','REVENUECAT_SECRET_KEY','REVENUECAT_WEBHOOK_SECRET','EXPO_ACCESS_TOKEN',
  'GOOGLE_CALENDAR_CLIENT_SECRET','GOOGLE_CALENDAR_TOKEN_KEY','PINTEREST_APP_SECRET','PINTEREST_ACCESS_TOKEN',
  'PINTEREST_SIGNING_SECRET','PINTEREST_TOKEN_KEY','LAB_STRIPE_SANDBOX_KEY','LAB_STRIPE_CHECKOUT_KEY','LAB_STRIPE_WEBHOOK_SECRET'];
const canaries = Object.fromEntries(names.map(name => [name, `laqueCanary${randomBytes(24).toString('hex')}`]));
canaries.STRIPE_SECRET_KEY = 'sk_test_' + randomBytes(32).toString('hex');
canaries.PINTEREST_TOKEN_KEY = randomBytes(32).toString('base64');
canaries.GOOGLE_CALENDAR_TOKEN_KEY = randomBytes(32).toString('base64');
const needles = Object.values(canaries).flatMap(value => [value, Buffer.from(value).toString('base64'), encodeURIComponent(value)]).map(value => Buffer.from(value));
await mkdir(output, {recursive:true,mode:0o700});
const env = {...process.env,...testEnv,...canaries,VERCEL_ENV:'',MOBILE_ENVIRONMENT:'',PINTEREST_ENABLED:'0',PINTEREST_OAUTH_MODE:'0',GOOGLE_CALENDAR_ENABLED:'false'};
const logs = [];
const code = await new Promise((done, reject) => {
  const args=mobile?['node_modules/expo/bin/cli','export','--platform','ios','--platform','android','--output-dir','.expo/export']:['node_modules/next/dist/bin/next','build'];
  const child = spawn(process.execPath, args, {cwd:mobile?join(root,'mobile'):root,env:{...env,CI:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',bytes=>logs.push(bytes)); child.stderr.on('data',bytes=>logs.push(bytes));
  child.on('error',reject); child.on('exit',done);
});
const log = Buffer.concat(logs);
await writeFile(join(output,'build.log'),log,{mode:0o600});
if (code !== 0) { console.error('Credential canary build failed; inspect the private local build log.'); process.exitCode=1; }
else {
  let count=0;
  const leaks=[];
  const scan=(bytes,path)=>{
    count++;
    const text=bytes.toString('utf8');
    const serverKey=/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9]{20,}/.test(text);
    const serviceJwt=[...text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].some(match=>{
      try{return JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role'}catch{return false}
    });
    if(serverKey||serviceJwt||needles.some(value=>bytes.includes(value)))leaks.push(path);
  };
  scan(log,'build log');
  const walk=async directory=>{
    for(const entry of await readdir(directory,{withFileTypes:true})) {
      const path=join(directory,entry.name);
      if(entry.isDirectory()) await walk(path);
      else if(entry.isFile()) scan(await readFile(path),path.slice(root.length));
    }
  };
  await walk(join(root,mobile?'mobile/.expo/export':'.next/static'));
  if(mobile) {
    const config=await new Promise((done,reject)=>{
      const child=spawn(process.execPath,['node_modules/expo/bin/cli','config','--type','public','--json'],{cwd:join(root,'mobile'),env,stdio:['ignore','pipe','pipe']});
      const data=[];child.stdout.on('data',part=>data.push(part));child.on('error',reject);child.on('exit',status=>status===0?done(Buffer.concat(data)):reject(Error('Public config check failed')));
    });
    scan(config,'Expo public configuration');
  }
  const report={kind:'synthetic credential canary',platform:mobile?'iOS/Android Expo exports and public config':'web client',secretNames:names,checkedFiles:count,leaks,passed:leaks.length===0,
    limits:'Checks client output/config and build log. Does not certify hosted logs, old deployments, signed store artifacts or provider key scopes.'};
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checkedFiles:count,leakCount:leaks.length,passed:report.passed}));
  if(leaks.length)process.exitCode=1;
}
