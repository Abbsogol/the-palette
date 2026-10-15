import { validateEnvironment, validateServiceIdentity, schemeForEnvironment } from '../src/lib/config';
const production={appEnv:'production',apiUrl:'https://www.laque.app',supabaseUrl:'https://faunikvhoommbebsmevg.supabase.co',projectRef:'faunikvhoommbebsmevg',supabaseKey:'sb_publishable_fixture'};
test('production accepts approved origin/project and a separate scheme',()=>{
  expect(validateEnvironment(production)).toBeNull();
  expect(schemeForEnvironment('production')).toBe('laque-app');
  expect(schemeForEnvironment('beta')).toBe('laque');
});
test.each([{apiUrl:'https://laque-beta.vercel.app'},{apiUrl:'https://www.laque.app.evil.invalid'},{projectRef:'atjwbdrvgljddedtwoqo',supabaseUrl:'https://atjwbdrvgljddedtwoqo.supabase.co'},{supabaseKey:'sb_secret_fixture'},{apiUrl:'https://www.laque.app/path'},{apiUrl:'https://www.laque.app?redirect=evil'}])('production refuses wrong binding: %j',overrides=>expect(validateEnvironment({...production,...overrides})).not.toBeNull());
test.each(['beta','development'])('%s refuses production database and API independently',appEnv=>{
  expect(validateEnvironment({...production,appEnv})).toMatch(/production/);
  expect(validateEnvironment({...production,appEnv,apiUrl:'https://beta.example.invalid'})).toMatch(/production/);
  expect(validateEnvironment({...production,appEnv,supabaseUrl:'https://isolated.supabase.co',projectRef:'isolated'})).toMatch(/production/);
});
test('production handshake binds environment, project, API origin and return scheme',()=>{
  const identity={environment:'production',projectRef:production.projectRef,apiOrigin:production.apiUrl,appScheme:'laque-app',contractVersion:1};
  expect(validateServiceIdentity(identity,production)).toBe(true);
  for(const override of [{environment:'beta'},{projectRef:'isolated'},{apiOrigin:'https://laque-beta.vercel.app'},{appScheme:'laque'},{contractVersion:2}])expect(validateServiceIdentity({...identity,...override},production)).toBe(false);
  expect(validateServiceIdentity({environment:'production',projectRef:production.projectRef,contractVersion:1},production)).toBe(false);
});
test('older beta contract still works',()=>{
  expect(validateServiceIdentity({environment:'beta',projectRef:'isolated',contractVersion:1},{...production,appEnv:'beta',apiUrl:'https://beta.example.invalid',projectRef:'isolated'})).toBe(true);
});
test('runtime refuses a production service label in a beta manifest',()=>{
 const original=process.env;
 process.env={...original,EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_API_URL:production.apiUrl,EXPO_PUBLIC_SUPABASE_URL:production.supabaseUrl,EXPO_PUBLIC_SUPABASE_PROJECT_REF:production.projectRef,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:production.supabaseKey};
 jest.doMock('expo-constants',()=>({__esModule:true,default:{expoConfig:{extra:{appEnvironment:'beta'}}}}));
 try {jest.isolateModules(()=>{expect(require('../src/lib/config').configurationError).toMatch(/different environments/);});}
 finally {process.env=original;jest.dontMock('expo-constants');}
});
