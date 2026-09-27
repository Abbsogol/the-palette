// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({auth:{getSession:vi.fn(),signOut:vi.fn(),refreshSession:vi.fn(),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}))
vi.mock('@/lib/supabase',()=>({supabase:mock}))
import DeleteAccountButton from '@/components/DeleteAccountButton'
const success=()=>({ok:true,json:async()=>({ok:true})})
beforeEach(()=>{
  vi.clearAllMocks()
  vi.stubGlobal('confirm',vi.fn(()=>true))
  vi.stubGlobal('fetch',vi.fn(async()=>success()))
  mock.auth.getSession.mockResolvedValue({data:{session:{user:{id:'account-a'},access_token:'test-token'}}})
  mock.auth.signOut.mockResolvedValue({error:null})
  mock.auth.refreshSession.mockImplementation(async()=>{mock.auth.getSession.mockResolvedValue({data:{session:null}});return {data:{session:null},error:{code:'refresh_token_not_found'}}})
})
afterEach(cleanup)
it.each(['database error','network error'])('keeps the user signed in and shows deletion failure on %s',async kind=>{
  if(kind==='database error')fetch.mockResolvedValue({ok:false,json:async()=>({error:'Your account could not be deleted.'})})
  else fetch.mockRejectedValue(new Error('Your account could not be deleted: connection lost.'))
  render(<DeleteAccountButton userId="account-a" />)
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Delete account'})))
  expect(screen.getByRole('alert')).toHaveTextContent('Your account could not be deleted')
  expect(mock.auth.signOut).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Delete account'})).toBeEnabled()
  fetch.mockResolvedValue(success())
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Delete account'})))
  expect(mock.auth.refreshSession).toHaveBeenCalledTimes(1)
})
it('clears the deleted session only after confirmed account deletion',async()=>{
  let finish
  fetch.mockReturnValue(new Promise(resolve=>{finish=resolve}))
  render(<DeleteAccountButton userId="account-a" />)
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Delete account'})))
  expect(mock.auth.signOut).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Deleting account…'})).toBeDisabled()
  await act(async()=>finish(success()))
  expect(fetch).toHaveBeenCalledWith('/api/delete-account',{method:'POST',headers:{Authorization:'Bearer test-token'}})
  expect(mock.auth.refreshSession).toHaveBeenCalledWith()
  expect(mock.auth.signOut).not.toHaveBeenCalled()
})
it('does nothing when the user cancels confirmation',()=>{
  confirm.mockReturnValue(false)
  render(<DeleteAccountButton userId="account-a" />)
  fireEvent.click(screen.getByRole('button',{name:'Delete account'}))
  expect(fetch).not.toHaveBeenCalled()
  expect(mock.auth.signOut).not.toHaveBeenCalled()
})
it('distinguishes completed deletion from a session cleanup failure',async()=>{
  mock.auth.refreshSession.mockRejectedValue(new Error('Local session failed'))
  render(<DeleteAccountButton userId="account-a" />)
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Delete account'})))
  expect(screen.getByRole('alert')).toHaveTextContent('Your account was deleted. Please refresh')
  expect(fetch).toHaveBeenCalledTimes(1)
})
