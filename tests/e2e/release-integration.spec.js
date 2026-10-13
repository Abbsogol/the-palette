import {test,expect} from '@playwright/test'
const user={id:'00000000-0000-4000-8000-000000000951',aud:'authenticated',role:'authenticated',email:'release-check@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-13T00:00:00Z'}
const design={id:'00000000-0000-4000-8000-000000000952',title:'Protected design board',image_url:'http://127.0.0.1:54321/storage/v1/object/public/nail-lab/'+user.id+'/draft.png',image_width:300,image_height:400,shape:'Almond',category:'Minimal',is_published:true,created_by:null}
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(baseURL).origin?route.continue():route.abort())
 await page.addInitScript(user=>{
  const exp=Math.floor(Date.now()/1000)+3600
  const token=`${btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${btoa(JSON.stringify({sub:user.id,exp}))}.offline`
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'offline-refresh',token_type:'bearer',expires_at:exp,user}))
 },user)
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const {pathname,searchParams}=new URL(route.request().url())
  if(pathname==='/auth/v1/user')return route.fulfill({json:user})
  if(pathname==='/rest/v1/designs')return route.fulfill({json:searchParams.get('id')==='eq.'+design.id?design:[]})
  if(pathname.startsWith('/storage/v1/object/sign/'))return route.fulfill({json:{signedURL:'/object/sign/nail-lab/mock-preview.png?token=offline'}})
  return route.fulfill({json:[]})
 })
})
test('member design detail uses RLS and authenticated private image access, then clears a removed design on foreground',async({page})=>{
 let permitted=true,authHeader,signHeader
 await page.route('**/rest/v1/designs?**',route=>{
  const query=new URL(route.request().url()).searchParams
  if(query.get('id')==='eq.'+design.id){authHeader=route.request().headers().authorization;return route.fulfill({json:permitted?design:null})}
  return route.fulfill({json:[]})
 })
 await page.route('**/storage/v1/object/sign/**',route=>{
  if(route.request().method()==='POST'){signHeader=route.request().headers().authorization;return route.fulfill({json:{signedURL:'/object/sign/nail-lab/mock-preview.png?token=offline'}})}
  return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#7c263d"/></svg>'})
 })
 await page.goto('/design/'+design.id)
 await expect(page.getByRole('heading',{name:design.title})).toBeVisible()
 await expect(page.getByAltText(design.title+' 1')).toHaveAttribute('src',/\/sign\/nail-lab\/mock-preview/)
 expect(authHeader).toMatch(/^Bearer /);expect(signHeader).toMatch(/^Bearer /)
 permitted=false
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
 await expect(page.getByText('Design unavailable.')).toBeVisible()
 await expect(page.getByRole('heading',{name:design.title})).toHaveCount(0)
})
test('member search keeps the current web descriptor fields and deep-linked query without hydration errors',async({page})=>{
 const errors=[],queries=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/rest/v1/designs?**',route=>{queries.push(new URL(route.request().url()).searchParams);return route.fulfill({json:[design]})})
 await page.goto('/search?q=chrome')
 await expect(page.getByRole('searchbox', {name:'Search designs'})).toHaveValue('chrome')
 await expect(page.getByText(design.title)).toBeVisible()
 const or=queries.find(q=>q.get('or')?.includes('description.ilike'))?.get('or')
 for(const field of ['title','description','occasion','technique','category','shape','length'])expect(or).toContain(field+'.ilike')
 expect(errors).toEqual([])
})
