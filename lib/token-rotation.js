import { createDecipheriv } from 'node:crypto';
import { tokenKeyring, openTokenEnvelope, sealTokenEnvelope } from './token-encryption.js';

const tables = {
  PINTEREST: [{table:'pinterest_connection',id:'singleton',fields:['access_cipher','refresh_cipher']}],
  GOOGLE_CALENDAR: [
    {table:'google_calendar_connections',id:'user_id',fields:['refresh_token_encrypted']},
    {table:'google_calendar_oauth',id:'id',fields:['grant_encrypted']},
  ],
};
function legacyOpen(value, provider, scope, key) {
  const bytes=Buffer.from(value,'base64');
  if(bytes.length<29 || bytes.toString('base64')!==value)throw Error('TOKEN_CIPHER_INVALID');
  const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(provider==='PINTEREST'?'laque-pinterest-v1':scope));
  cipher.setAuthTag(provider==='PINTEREST'?bytes.subarray(12,28):bytes.subarray(-16));
  try{return Buffer.concat([cipher.update(provider==='PINTEREST'?bytes.subarray(28):bytes.subarray(12,-16)),cipher.final()]).toString('utf8')}
  catch{throw Error('TOKEN_CIPHER_INVALID')}
}
// Service-client maintenance utility, intentionally not exposed over HTTP.
// Scan before applying. Never retire a key based on a partial page or failures.
export async function rotateProviderTokens(db,{provider,apply=false,offset=0,limit=100},env=process.env) {
  if(!Object.hasOwn(tables,provider)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('TOKEN_ROTATION_CONFIGURATION');
  const ring=tokenKeyring(provider,env);
  if(!ring.id)throw Error('TOKEN_ROTATION_REQUIRES_VERSIONED_KEY');
  const report={scanned:0,old:0,rotated:0,conflicts:0,failed:0,more:false};
  for(const spec of tables[provider]) {
    const {data,error}=await db.from(spec.table).select('*').order(spec.id).range(offset,offset+limit);
    if(error)throw Error('TOKEN_ROTATION_READ_FAILED');
    const rows=data||[];if(rows.length>limit)report.more=true;
    for(const row of rows.slice(0,limit))for(const field of spec.fields) {
      const old=row[field];if(!old)continue;report.scanned++;
      const scope=provider==='PINTEREST'?'connection':row.user_id;
      try {
        const plain=openTokenEnvelope(old,provider,scope,key=>legacyOpen(old,provider,scope,key),env);
        if(old.startsWith(`v2.${ring.id}.`))continue;
        report.old++;
        if(!apply)continue;
        const replacement=sealTokenEnvelope(plain,provider,scope,()=>{throw Error('TOKEN_ROTATION_CONFIGURATION')},env);
        const result=await db.from(spec.table).update({[field]:replacement}).eq(spec.id,row[spec.id]).eq(field,old).select(spec.id);
        if(result.error)report.failed++;
        else if(result.data?.length)report.rotated++;
        else report.conflicts++; // A refresh/disconnect won; never overwrite it.
      } catch {report.failed++;}
    }
  }
  return report;
}
