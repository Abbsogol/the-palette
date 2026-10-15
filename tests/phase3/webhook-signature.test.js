import Stripe from 'stripe'
import { beforeEach,expect,it,vi } from 'vitest'
const client=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}))
vi.mock('@/lib/auth',()=>({serviceClient:client}))
import { POST } from '@/app/api/stripe-webhook/route'
const stripe=new Stripe('sk_test_offline_no_network')
const body=JSON.stringify({id:'evt_signed',type:'unhandled.test_event',data:{object:{}}})
const header=(timestamp=Math.floor(Date.now()/1000))=>stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET,timestamp})
const request=(payload,signature)=>new Request('http://localhost/api/stripe-webhook',{method:'POST',body:payload,headers:{'stripe-signature':signature}})
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{})})
it('accepts a valid Stripe signature over the exact raw body',async()=>{
  expect((await POST(request(body,header()))).status).toBe(200)
  expect(client.rpc).not.toHaveBeenCalled()
})
it.each(['tampered','expired','missing'])('rejects a %s signature before data access',async kind=>{
  const payload=kind==='tampered'?body+' ':body
  const signature=kind==='expired'?header(1):kind==='missing'?'':header()
  expect((await POST(request(payload,signature))).status).toBe(400)
  expect(client.from).not.toHaveBeenCalled();expect(client.rpc).not.toHaveBeenCalled()
})
