import { labBillingRoute, type StoreEligibility } from '../src/lib/lab-billing-route';
const now=Date.now(),policy={sandboxPilot:false,enabledPrograms:[]};
const evidence:StoreEligibility={source:'storekit',country:'FR',eligible:true,disclosureAvailable:true,reportingAvailable:true,checkedAt:now,osVersion:27};
test('sandbox permission never grants release Stripe access and web cannot use native checkout',()=>{
 expect(labBillingRoute('ios',true,{...policy,sandboxPilot:true},null,now)).toBe('stripe_sandbox');
 expect(labBillingRoute('ios',false,{...policy,sandboxPilot:true},null,now)).toBe('store');
 expect(labBillingRoute('web',true,{...policy,sandboxPilot:true},null,now)).toBe('store');
});
test('eligible country needs an enrolled program, fresh store evidence, disclosures and reporting',()=>{
 const enrolled={...policy,enabledPrograms:['apple_eu' as const]};
 expect(labBillingRoute('ios',false,policy,evidence,now)).toBe('store');
 expect(labBillingRoute('ios',false,enrolled,evidence,now)).toBe('stripe');
 for(const change of [{eligible:false},{disclosureAvailable:false},{reportingAvailable:false},{checkedAt:now-300001},{checkedAt:now+1},{country:'AE'},{country:'US'},{source:'play_billing' as const}])expect(labBillingRoute('ios',false,enrolled,{...evidence,...change},now)).toBe('store');
});
test('Japan/Brazil and Play choice regions require a provider choice; US iOS stays store',()=>{
 expect(labBillingRoute('ios',false,{...policy,enabledPrograms:['apple_japan']},{...evidence,country:'JP'},now)).toBe('choice');
 expect(labBillingRoute('ios',false,{...policy,enabledPrograms:['apple_brazil']},{...evidence,country:'BR',osVersion:26.2},now)).toBe('store');
 expect(labBillingRoute('android',false,{...policy,enabledPrograms:['play_choice']},{...evidence,source:'play_billing',country:'IN'},now)).toBe('choice');
 expect(labBillingRoute('android',false,{...policy,enabledPrograms:['play_us']},{...evidence,source:'play_billing',country:'US'},now)).toBe('stripe');
});
