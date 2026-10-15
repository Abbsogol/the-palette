import Stripe from 'stripe';
import {expect,it} from 'vitest';
import {verifyStripeSignature} from '../../lib/stripe-webhook-signature';
const stripe=new Stripe('sk_test_synthetic');
const body=JSON.stringify({id:'evt_synthetic',type:'invoice.paid',livemode:false});
const sign=secret=>stripe.webhooks.generateTestHeaderString({payload:body,secret});
it('accepts current and retiring signatures only during the configured overlap',()=>{
  expect(verifyStripeSignature(stripe,body,sign('new'),'new','old').id).toBe('evt_synthetic');
  expect(verifyStripeSignature(stripe,body,sign('old'),'new','old').id).toBe('evt_synthetic');
  expect(()=>verifyStripeSignature(stripe,body,sign('old'),'new')).toThrow();
});
it('rejects unsigned, stale and altered payloads even with two secrets',()=>{
  expect(()=>verifyStripeSignature(stripe,body,null,'new','old')).toThrow();
  expect(()=>verifyStripeSignature(stripe,body+' ',sign('old'),'new','old')).toThrow();
  const stale=stripe.webhooks.generateTestHeaderString({payload:body,secret:'old',timestamp:1});
  expect(()=>verifyStripeSignature(stripe,body,stale,'new','old')).toThrow();
});
