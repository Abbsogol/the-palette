// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
import { bookingCalendar, bookingCanTakeDeposit, bookingHasEnded, calendarKey } from '@/lib/booking-time'
const mock=vi.hoisted(()=>({client:{},session:null,callbacks:new Set(),router:{push:vi.fn(),back:vi.fn()},params:'serviceId=service&note=100%25%20gel',zone:'Pacific/Kiritimati',writes:[]}))
vi.mock('@/lib/supabase',()=>({supabase:mock.client}))
vi.mock('next/navigation',()=>({useRouter:()=>mock.router,useParams:()=>({creatorId:'creator'}),useSearchParams:()=>new URLSearchParams(mock.params)}))
import Booking from '@/app/book/[creatorId]/page'
const session=id=>({user:{id},access_token:`token-${id}`})
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {resolve,promise}}
const click=async name=>act(async()=>fireEvent.click(screen.getByRole('button',{name})))
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-27T23:30:00Z'));vi.clearAllMocks();mock.callbacks.clear();mock.session=session('client');mock.zone='Pacific/Kiritimati';mock.writes=[]
  Object.assign(mock.client,database(q=>{
    if(q.table==='profiles')return ok({id:'creator',display_name:'Creator',account_type:'creator',...(q.columns?.includes('booking_area')?{booking_area:'Dubai studio',location:'Dubai'}:{})})
    if(q.table==='services')return ok([{id:'service',name:'Manicure',duration_minutes:30,price:100}])
    if(q.table==='availability')return ok(Array.from({length:7},(_,day_of_week)=>({day_of_week,start_time:'00:00',end_time:'24:00',is_active:true})))
    if(q.table==='follows')return ok(null)
    if(q.table==='creator_booking_settings')return ok(mock.zone?{time_zone:mock.zone}:null)
    if(q.table==='bookings'){mock.writes.push(q);return ok({id:'booking'})}
    throw new Error(`Unexpected table ${q.table}`)
  }))
  mock.client.rpc=vi.fn(async()=>ok([{start_time:'14:00:00',available:true},{start_time:'14:30:00',available:false}]))
  mock.client.auth={getSession:vi.fn(async()=>({data:{session:mock.session}})),getUser:vi.fn(async()=>({data:{user:mock.session?.user}})),onAuthStateChange:cb=>{mock.callbacks.add(cb);return {data:{subscription:{unsubscribe:()=>mock.callbacks.delete(cb)}}}}}
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true})))
})
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs()})
const chooseTime=async()=>{await act(async()=>render(<Booking/>));await click('2026-09-28');await click('Continue');await click('2pm');await click('Continue')}
it('calendar dates follow the creator, regardless of the visitor date',()=>{
  const available=zone=>bookingCalendar([{day_of_week:1}],zone,new Date('2026-09-28T00:30:00Z')).filter(d=>d.available).map(d=>calendarKey(d.date))
  expect(available('Pacific/Kiritimati')[0]).toBe('2026-09-28')
  expect(available('America/Los_Angeles')[0]).toBe('2026-09-28')
  expect(bookingCalendar([{day_of_week:0}],'America/Los_Angeles',new Date('2026-09-28T00:30:00Z')).find(d=>calendarKey(d.date)==='2026-09-27')?.available).toBe(true)
})
it('booking submits a creator-local date and zone while preserving literal percent notes',async()=>{
  await chooseTime()
  expect(screen.getByText(/All appointment times are in Pacific\/Kiritimati/)).toBeVisible()
  expect(screen.getByRole('textbox')).toHaveValue('100% gel')
  await click(/Send booking request/)
  expect(mock.writes).toHaveLength(1)
  expect(mock.writes[0].values).toMatchObject({client_id:'client',creator_id:'creator',booking_date:'2026-09-28',start_time:'14:00',end_time:'14:30',time_zone:'Pacific/Kiritimati',notes:'100% gel'})
  expect(screen.getByText('Request sent!')).toBeVisible()
})
it('an unconfigured creator cannot offer bookable calendar dates',async()=>{
  mock.zone=null;await act(async()=>render(<Booking/>))
  expect(screen.getByText(/needs to set their appointment time zone/)).toBeVisible()
  expect(screen.getByRole('button',{name:'Continue'})).toBeDisabled()
  expect(mock.client.rpc).not.toHaveBeenCalled()
})
it('a failed slot lookup has a visible error and offers no submit path',async()=>{
  mock.client.rpc.mockResolvedValueOnce({data:null,error:{message:'unavailable'}})
  await act(async()=>render(<Booking/>));await click('2026-09-28');await click('Continue')
  expect(screen.getByRole('alert')).toHaveTextContent('Available times could not be confirmed')
  expect(screen.queryByRole('button',{name:'2pm'})).not.toBeInTheDocument()
  expect(mock.writes).toHaveLength(0)
})
it('a delayed old date lookup cannot overwrite the newly selected date',async()=>{
  const pending=deferred();mock.client.rpc.mockReturnValueOnce(pending.promise)
  await act(async()=>render(<Booking/>));await click('2026-09-28');await click('2026-09-29');await click('Continue')
  await act(async()=>pending.resolve(ok([{start_time:'09:00:00',available:true}])))
  expect(screen.getByRole('button',{name:'2pm'})).toBeEnabled()
  expect(screen.queryByRole('button',{name:'9am'})).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'2:30pm'})).toBeDisabled()
})
it('a booking form cannot submit using another account after its session changes',async()=>{
  await chooseTime();mock.session=session('other')
  await click(/Send booking request/)
  expect(mock.writes).toHaveLength(0)
})
it('history and deposit eligibility use the saved instants, including same-day outcomes',()=>{
  const now=new Date('2026-09-28T00:30:00Z')
  expect(bookingHasEnded({booking_date:'2026-09-28',ends_at:'2026-09-28T00:00:00Z'},now)).toBe(true)
  expect(bookingCanTakeDeposit({status:'confirmed',booking_date:'2026-09-27',starts_at:'2026-09-28T01:00:00Z'},now)).toBe(true)
  expect(bookingCanTakeDeposit({status:'confirmed',booking_date:'2026-09-28',starts_at:'2026-09-28T00:00:00Z'},now)).toBe(false)
  expect(bookingCanTakeDeposit({status:'confirmed'},now)).toBe(false)
  expect(bookingHasEnded({},now)).toBe(false)
})

it('calendar-enabled web booking preserves reviewed location and requires explicit client conflict consent',async()=>{
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED','true')
  let sent
  vi.mocked(fetch).mockImplementation(async (url,options)=>{
    if(url.startsWith('/api/mobile/calendar-slots'))return Response.json({slots:[{start_time:'14:00:00',available:true,client_calendar_conflict:true,client_calendar_state:'checked'}]})
    if(url==='/api/mobile/request-booking'){sent=JSON.parse(options.body);return Response.json({booking:{id:'booking'}})}
    return Response.json({ok:true})
  })
  await chooseTime()
  expect(screen.getByRole('button',{name:/Send booking request/})).toBeDisabled()
  await act(async()=>fireEvent.click(screen.getByRole('checkbox')))
  await click(/Send booking request/)
  expect(sent).toMatchObject({location:'Dubai studio',allowCalendarConflict:true,price:100,timeZone:'Pacific/Kiritimati'})
  expect(mock.writes).toHaveLength(0)
  expect(screen.getByText('Request sent!')).toBeVisible()
})
