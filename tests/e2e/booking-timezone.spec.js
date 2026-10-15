import { test, expect } from '@playwright/test'

const user={id:'00000000-0000-4000-8000-000000000701',aud:'authenticated',role:'authenticated',email:'client@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-09-27T00:00:00Z'}
const creator='00000000-0000-4000-8000-000000000702'
const service={id:'00000000-0000-4000-8000-000000000703',creator_id:creator,name:'Manicure',duration_minutes:30,price:100,is_active:true}
test.beforeEach(async({page,baseURL})=>{
  await page.clock.setFixedTime(new Date('2026-09-27T23:30:00Z'))
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(baseURL).origin?route.continue():route.abort())
  await page.addInitScript(user=>{
    const token=`${btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${btoa(JSON.stringify({sub:user.id,exp:1790641800}))}.offline`
    localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'offline-refresh',token_type:'bearer',expires_at:1790641800,user}))
  },user)
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const {pathname}=new URL(route.request().url())
    if(pathname==='/auth/v1/user')return route.fulfill({json:user})
    if(pathname==='/rest/v1/profiles')return route.fulfill({json:{id:creator,display_name:'Artist',account_type:'creator'}})
    if(pathname==='/rest/v1/services')return route.fulfill({json:[service]})
    if(pathname==='/rest/v1/availability')return route.fulfill({json:Array.from({length:7},(_,day_of_week)=>({day_of_week,start_time:'00:00',end_time:'24:00',is_active:true}))})
    if(pathname==='/rest/v1/creator_booking_settings')return route.fulfill({json:{time_zone:'Pacific/Kiritimati'}})
    if(pathname==='/rest/v1/follows')return route.fulfill({json:null})
    if(pathname==='/rest/v1/rpc/booking_available_slots')return route.fulfill({json:[{start_time:'14:00:00',end_time:'14:30:00',available:true},{start_time:'14:30:00',end_time:'15:00:00',available:false}]})
    return route.fulfill({json:[]})
  })
})

test('creator-local calendar and time survive the production booking UI and SDK request',async({page})=>{
  let saved,slotRequest
  await page.route('**/rest/v1/rpc/booking_available_slots',route=>{slotRequest=route.request().postDataJSON();return route.fulfill({json:[{start_time:'14:00:00',end_time:'14:30:00',available:true},{start_time:'14:30:00',end_time:'15:00:00',available:false}]})})
  await page.route('**/rest/v1/bookings?**',route=>{saved=route.request().postDataJSON();return route.fulfill({json:{id:'booking',...saved}})})
  await page.route('**/api/add-reward',route=>route.fulfill({json:{ok:true}}))
  await page.goto(`/book/${creator}?serviceId=${service.id}&note=100%25%20gel`)
  await expect(page.getByText('All appointment times are in Pacific/Kiritimati.')).toBeVisible()
  await expect(page.getByRole('button',{name:'2026-09-27',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'2026-09-28',exact:true}).click()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('button',{name:'2:30pm',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'2pm',exact:true}).click()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('textbox')).toHaveValue('100% gel')
  await page.getByRole('button',{name:/Send booking request/}).click()
  await expect(page.getByRole('heading',{name:'Request sent!'})).toBeVisible()
  expect(slotRequest).toMatchObject({p_creator_id:creator,p_date:'2026-09-28',p_service_id:service.id})
  expect(saved).toMatchObject({client_id:user.id,creator_id:creator,booking_date:'2026-09-28',start_time:'14:00',end_time:'14:30',time_zone:'Pacific/Kiritimati',notes:'100% gel'})
})

test('a slot service failure stays visible and cannot report a successful booking',async({page})=>{
  await page.route('**/rest/v1/rpc/booking_available_slots',route=>route.fulfill({status:503,json:{message:'Temporary failure'}}))
  await page.goto(`/book/${creator}?serviceId=${service.id}`)
  await page.getByRole('button',{name:'2026-09-28',exact:true}).click()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'Available times could not be confirmed'})).toContainText('Available times could not be confirmed')
  await expect(page.getByRole('button',{name:/Send booking request/})).toHaveCount(0)
})
