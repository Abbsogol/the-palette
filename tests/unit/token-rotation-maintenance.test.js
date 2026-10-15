import {expect,it} from 'vitest';
import {rotateProviderTokens} from '../../lib/token-rotation';
import {sealTokenEnvelope,openTokenEnvelope} from '../../lib/token-encryption';
const first=Buffer.alloc(32,41).toString('base64'),second=Buffer.alloc(32,42).toString('base64');
const env={MOBILE_ENVIRONMENT:'beta',PINTEREST_TOKEN_KEY:second,PINTEREST_TOKEN_KEY_ID:'new',PINTEREST_TOKEN_PREVIOUS_KEYS:JSON.stringify({old:first})};
const old=()=>sealTokenEnvelope('syntheticGrant','PINTEREST','connection',()=>{}, {...env,PINTEREST_TOKEN_KEY:first,PINTEREST_TOKEN_KEY_ID:'old',PINTEREST_TOKEN_PREVIOUS_KEYS:'{}'});
const fake=(row,race=false)=>({
  from(){
    let patch;
    return {
      select(){return this}, order(){return this}, range:async()=>({data:[row]}),
      update(value){patch=value;return this}, eq(){return this},
      then(resolve){
        if(race) resolve({data:[]});
        else {Object.assign(row,patch);resolve({data:[{singleton:true}]})}
      },
    };
  },
});
it('dry-run leaves credentials untouched and apply reseals with compare-and-swap',async()=>{
  const row={singleton:true,access_cipher:old(),refresh_cipher:old()};const before={...row};
  expect(await rotateProviderTokens(fake(row),{provider:'PINTEREST'},env)).toMatchObject({old:2,rotated:0,failed:0});expect(row).toEqual(before);
  expect(await rotateProviderTokens(fake(row),{provider:'PINTEREST',apply:true},env)).toMatchObject({rotated:2,conflicts:0,failed:0});
  expect(openTokenEnvelope(row.access_cipher,'PINTEREST','connection',()=>{},env)).toBe('syntheticGrant');
  expect(await rotateProviderTokens(fake(row),{provider:'PINTEREST',apply:true},env)).toMatchObject({old:0,rotated:0});
});
it('does not overwrite concurrent provider changes or erase unreadable tokens',async()=>{
  const row={singleton:true,access_cipher:old(),refresh_cipher:'malformed'};const before={...row};
  expect(await rotateProviderTokens(fake(row,true),{provider:'PINTEREST',apply:true},env)).toMatchObject({rotated:0,conflicts:1,failed:1});
  expect(row).toEqual(before);
});
