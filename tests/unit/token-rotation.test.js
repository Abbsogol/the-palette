import { expect, it } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { sealTokenEnvelope, openTokenEnvelope, tokenKeyring } from '../../lib/token-encryption';
const first=Buffer.alloc(32,31).toString('base64'),second=Buffer.alloc(32,32).toString('base64');
const oldEnv={MOBILE_ENVIRONMENT:'beta',PINTEREST_TOKEN_KEY:first,PINTEREST_TOKEN_KEY_ID:'old'};
const current={MOBILE_ENVIRONMENT:'beta',PINTEREST_TOKEN_KEY:second,PINTEREST_TOKEN_KEY_ID:'new',PINTEREST_TOKEN_PREVIOUS_KEYS:JSON.stringify({old:first})};
const fail=()=>{throw Error('Legacy fallback must not run')};
it('rotates without losing old ciphertext and binds new tokens to provider, scope and environment',()=>{
  const old=sealTokenEnvelope('private','PINTEREST','connection',fail,oldEnv);
  expect(openTokenEnvelope(old,'PINTEREST','connection',fail,current)).toBe('private');
  const value=sealTokenEnvelope('private','PINTEREST','connection',fail,current);
  expect(value.startsWith('v2.new.')).toBe(true);
  expect(()=>openTokenEnvelope(value,'PINTEREST','other',fail,current)).toThrow();
  expect(()=>openTokenEnvelope(value,'PINTEREST','connection',fail,{...current,MOBILE_ENVIRONMENT:'production'})).toThrow();
  expect(()=>openTokenEnvelope(old,'PINTEREST','connection',fail,{...current,PINTEREST_TOKEN_PREVIOUS_KEYS:'{}'})).toThrow();
});
it('retains explicitly configured legacy bytes during the two-phase rotation',()=>{
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(first,'base64'),iv);
  cipher.setAAD(Buffer.from('laque-pinterest-v1'));
  const encrypted=Buffer.concat([cipher.update('legacy'),cipher.final()]);
  const value=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
  const env={...current,PINTEREST_TOKEN_LEGACY_KEY:first};
  let actual;
  expect(openTokenEnvelope(value,'PINTEREST','connection',key=>{actual=key;return 'legacy'},env)).toBe('legacy');
  expect(actual.equals(Buffer.from(first,'base64'))).toBe(true);
});
it('rejects malformed base64, key IDs, untrusted key references and keyring JSON without leaking secrets',()=>{
  for(const extra of [{PINTEREST_TOKEN_KEY:'private-secret'},{PINTEREST_TOKEN_KEY_ID:'../bad'},{PINTEREST_TOKEN_PREVIOUS_KEYS:'invalid-secret'},{PINTEREST_TOKEN_PREVIOUS_KEYS:'[]'}])
    expect(()=>tokenKeyring('PINTEREST',{...current,...extra})).toThrow('TOKEN_KEY_CONFIGURATION');
  expect(()=>openTokenEnvelope('v2.unknown.YWJj','PINTEREST','connection',fail,current)).toThrow('TOKEN_CIPHER_INVALID');
});
