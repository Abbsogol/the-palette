// A country is necessary, but never sufficient, for alternative digital billing.
// Production adapters must obtain eligibility/disclosure results from StoreKit or
// Play Billing and receive the enabled program from the authenticated backend.
export const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const EEA_COUNTRIES = [...EU_COUNTRIES, 'IS','LI','NO'];
const PLAY_CHOICE_COUNTRIES = ['AU','BR','IN','ID','JP','ZA','KR','GB'];
export type AlternativeProgram = 'apple_eu' | 'apple_japan' | 'apple_brazil' | 'apple_korea' | 'play_us' | 'play_eea' | 'play_choice';
export type StoreEligibility = { source: 'storekit' | 'play_billing'; country: string; eligible: boolean; disclosureAvailable: boolean; reportingAvailable: boolean; checkedAt: number; osVersion?: number };
export type BillingRoutingPolicy = { sandboxPilot: boolean; enabledPrograms: AlternativeProgram[] };
export function labBillingRoute(platform: string, development: boolean, policy: BillingRoutingPolicy, evidence: StoreEligibility | null, now=Date.now()): 'stripe_sandbox' | 'stripe' | 'choice' | 'store' {
  if (!['ios','android'].includes(platform)) return 'store';
  if (development && policy.sandboxPilot) return 'stripe_sandbox';
  if (!evidence || !evidence.eligible || !evidence.disclosureAvailable || !evidence.reportingAvailable || evidence.checkedAt > now || now-evidence.checkedAt > 5*60*1000) return 'store';
  const country=evidence.country.toUpperCase();
  const enabled=(p:AlternativeProgram)=>policy.enabledPrograms.includes(p);
  if(platform==='ios' && evidence.source==='storekit') {
    if(EU_COUNTRIES.includes(country) && enabled('apple_eu')) return 'stripe';
    if(country==='JP' && (evidence.osVersion||0)>=26.2 && enabled('apple_japan')) return 'choice';
    if(country==='BR' && (evidence.osVersion||0)>=26.5 && enabled('apple_brazil')) return 'choice';
    if(country==='KR' && enabled('apple_korea')) return 'stripe';
  }
  if(platform==='android' && evidence.source==='play_billing') {
    if(country==='US' && enabled('play_us') || EEA_COUNTRIES.includes(country) && enabled('play_eea')) return 'stripe';
    if(PLAY_CHOICE_COUNTRIES.includes(country) && enabled('play_choice')) return 'choice';
  }
  return 'store';
}
