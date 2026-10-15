// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {database,ok} from '../helpers/supabase'
const m=vi.hoisted(()=>({client:{},session:null,change:null,design:null}))
vi.mock('@/lib/supabase',()=>({supabase:m.client}))
vi.mock('next/navigation',()=>({useParams:()=>({id:'design'}),useSearchParams:()=>new URLSearchParams()}))
vi.mock('@/components/ImageCarousel',()=>({default:()=>null}))
vi.mock('@/components/DesignSaveHeart',()=>({default:()=>null}))
vi.mock('@/components/DesignPrimaryActions',()=>({default:()=>null}))
vi.mock('@/components/DesignUtilityRow',()=>({default:()=>null}))
vi.mock('@/components/ShareButton',()=>({default:()=>null}))
vi.mock('@/components/ui/BackButton',()=>({default:()=>null}))
import DesignPage from '@/app/design/[id]/page'
const member=id=>({user:{id},access_token:'mock-token'})
beforeEach(()=>{
 m.session=member('a');m.design={id:'design',title:'Private draft',image_url:null,created_by:null}
 m.client.auth={getSession:async()=>({data:{session:m.session}}),onAuthStateChange:callback=>{m.change=callback;return {data:{subscription:{unsubscribe:vi.fn()}}}}}
 Object.assign(m.client,database(q=>q.table==='designs'&&q.single?ok(m.design):ok([])))
})
afterEach(cleanup)
it('signed-out design links never request member data',async()=>{
 m.session=null
 await act(async()=>render(<DesignPage/>))
 expect(screen.getByRole('heading',{name:'Sign in to view designs'})).toBeVisible();expect(m.client.from).not.toHaveBeenCalled()
})
it('uses the member RLS client and immediately clears detail on logout',async()=>{
 await act(async()=>render(<DesignPage/>))
 expect(screen.getByRole('heading',{name:'Private draft'})).toBeVisible()
 expect(m.client.calls.find(q=>q.table==='designs').filters).toEqual([['eq','id','design']])
 await act(async()=>{m.session=null;m.change('SIGNED_OUT',null)})
 expect(screen.queryByText('Private draft')).not.toBeInTheDocument()
})
it('refresh clears detail when moderation or author privacy removes access',async()=>{
 await act(async()=>render(<DesignPage/>));m.design=null
 await act(async()=>window.dispatchEvent(new Event('focus')))
 expect(screen.queryByText('Private draft')).not.toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('Design unavailable')
})
it('a late old-account detail cannot appear after a session switch',async()=>{
 let resolve
 m.client.from=database(q=>q.table==='designs'&&q.single?new Promise(done=>{resolve=done}):ok([])).from
 await act(async()=>render(<DesignPage/>))
 await act(async()=>{m.session=null;m.change('SIGNED_OUT',null)})
 await act(async()=>resolve(ok(m.design)))
 expect(screen.queryByText('Private draft')).not.toBeInTheDocument();expect(screen.getByRole('heading',{name:'Sign in to view designs'})).toBeVisible()
})
