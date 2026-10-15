import {createClient} from '@supabase/supabase-js';
import {rotateProviderTokens} from '../lib/token-rotation.js';
import {assertDeploymentBoundary} from '../lib/deployment-security.mjs';

// Run only from a trusted maintenance environment. No .env auto-loading, HTTP
// endpoint, plaintext token output or automatic key retirement.
const args=process.argv.slice(2), allowed=new Set(['--provider','--environment','--project','--offset','--limit','--apply','--reason']);
const options={};
try {
  for(let i=0;i<args.length;i++) {
    const name=args[i];
    if(!allowed.has(name)||Object.hasOwn(options,name))throw Error('arguments');
    if(name==='--apply')options[name]=true;
    else {if(!args[i+1]||args[i+1].startsWith('--'))throw Error('arguments');options[name]=args[++i];}
  }
  if(!['production','beta'].includes(options['--environment'])||process.env.MOBILE_ENVIRONMENT!==options['--environment'])throw Error('environment');
  if(options['--project']!==process.env.MOBILE_SUPABASE_PROJECT_REF||!options['--project'])throw Error('project');
  if(process.env.NEXT_PUBLIC_SUPABASE_URL!==`https://${options['--project']}.supabase.co`)throw Error('project');
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('credential');
  if(options['--apply']&&(!options['--reason']||options['--reason'].trim().length<8))throw Error('reason');
  assertDeploymentBoundary();
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const report=await rotateProviderTokens(db,{
    provider:options['--provider'],apply:!!options['--apply'],offset:Number(options['--offset']||0),limit:Number(options['--limit']||100),
  });
  console.log(JSON.stringify({at:new Date().toISOString(),environment:options['--environment'],provider:options['--provider'],mode:options['--apply']?'apply':'dry-run',...report}));
  if(report.failed||report.conflicts)process.exitCode=1;
} catch {console.error('Token rotation refused or failed; inspect configuration and service access privately. No keys were retired.');process.exitCode=1;}
