// @vitest-environment jsdom
import { act,cleanup,render,screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { database,ok,user } from '../helpers/supabase'
const mock=vi.hoisted(()=>({client:{}}))
vi.mock('@/lib/supabase',()=>({supabase:mock.client}))
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams('plan=premium&booking=booking&session_id=cs_pending')}))
import UpgradeSuccess from '@/app/upgrade/success/page'
import DepositSuccess from '@/app/appointments/deposit-success/page'
beforeEach(()=>{
  vi.useFakeTimers()
  Object.assign(mock.client,database(()=>ok({subscription_tier:null,deposit_paid:false,status:'pending'})))
  mock.client.auth={getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user,access_token:'test-token'}}})}
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({status:'pending'})})))
})
afterEach(cleanup)
it('P3-12: an unconfirmed subscription never claims activation',async()=>{
  await act(async()=>render(<UpgradeSuccess/>))
  expect(screen.queryByText(/subscription is now active/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Confirming your subscription/)).toBeInTheDocument()
  await act(async()=>vi.advanceTimersByTimeAsync(15000))
  expect(screen.queryByText(/subscription is now active/i)).not.toBeInTheDocument()
})
it('P3-13: a paid deposit does not claim the creator confirmed a pending appointment',async()=>{
  fetch.mockResolvedValue({ok:true,json:async()=>({status:'fulfilled'})})
  await act(async()=>render(<DepositSuccess/>))
  expect(screen.getByText(/Deposit paid/)).toBeInTheDocument()
  expect(screen.queryByText(/appointment is confirmed/i)).not.toBeInTheDocument()
})

it.each([
  ['refund_pending','Refund in progress'],['refunded','Deposit refunded'],['refund_failed','Refund needs attention'],
])('a late deposit displays its %s outcome without claiming a paid appointment',async(status,heading)=>{
  fetch.mockResolvedValue({ok:true,json:async()=>({status})})
  await act(async()=>render(<DepositSuccess/>))
  expect(screen.getByRole('heading',{name:heading})).toBeInTheDocument()
  expect(screen.queryByText(/Deposit paid/)).not.toBeInTheDocument()
  expect(screen.queryByText(/appointment is confirmed/i)).not.toBeInTheDocument()
})

it('subscription status outages time out without displaying success',async()=>{
  fetch.mockRejectedValue(new Error('Unavailable'))
  await act(async()=>render(<UpgradeSuccess/>))
  await act(async()=>vi.advanceTimersByTimeAsync(15000))
  expect(screen.queryByText(/subscription is now active/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Still finalizing/)).toBeInTheDocument()
})
it('subscription success uses the server-confirmed plan',async()=>{
  fetch.mockResolvedValue({ok:true,json:async()=>({status:'fulfilled',planId:'pro_creator'})})
  await act(async()=>render(<UpgradeSuccess/>))
  expect(screen.getByText(/Welcome to Pro Creator/)).toBeInTheDocument()
  expect(screen.getByText(/Subscription confirmed/)).toBeInTheDocument()
})
