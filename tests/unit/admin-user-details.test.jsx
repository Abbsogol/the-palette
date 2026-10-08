// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import UserDetails from '@/app/admin/user-details'
afterEach(cleanup)
const detail={profile:{id:'user',display_name:'Nail User',username:'nail.user',account_type:'user',email:'test@example.invalid'},activity:{Followers:4},services:[],hours:[]};
it('shows operational details and makes private fields Owner-only',()=>{const view=render(<UserDetails detail={detail} owner={false}/>);expect(screen.getByText('Profile & contact')).toBeDefined();expect(screen.getByText('Related activity')).toBeDefined();expect(screen.queryByText('Sign-in information')).toBeNull();expect(screen.queryByText('Personal nail preferences & booking notes')).toBeNull();view.rerender(<UserDetails detail={detail} owner/>);expect(screen.getByText('Personal nail preferences & booking notes')).toBeDefined();expect(screen.getByText('Subscription, tokens & account usage')).toBeDefined()})
