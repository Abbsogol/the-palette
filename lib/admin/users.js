import { serviceClient as db } from '@/lib/auth';
import { AdminError } from './auth';
export async function userDirectory(identity, {q='',filter='',offset=0,limit=25,id=null}={}) {
  const r=await db.rpc('admin_user_directory',{p_actor:identity.user.id,p_query:q,p_type:filter,p_offset:offset,p_limit:limit,p_id:id});
  if(r.error)throw new AdminError('Accounts could not load. Try again.',503);
  return r.data||[];
}
async function checked(q){const r=await q;if(r.error)throw new AdminError('Account details could not load. Try again.',503);return r.data}
async function count(table,column,id){const r=await db.from(table).select('*',{head:true,count:'exact'}).eq(column,id);if(r.error)throw new AdminError('Account activity could not load. Try again.',503);return r.count||0}
export async function userDetails(identity,id){
  const profiles=await userDirectory(identity,{id,limit:1});if(!profiles.length)throw new AdminError('Account unavailable.',404);
  const profile=profiles[0];
  const tasks=[
    checked(db.from('admin_suspensions').select('suspended,updated_at').eq('user_id',id).maybeSingle()),
    checked(db.from('admin_notes').select('id,body,actor_id,created_at').eq('target_type','user').eq('target_id',id).order('created_at',{ascending:false}).limit(50)),
    checked(db.from('services').select('id,name,description,duration_minutes,price,deposit_amount,is_active').eq('creator_id',id).order('created_at',{ascending:false}).limit(100)),
    checked(db.from('availability').select('day_of_week,start_time,end_time,is_active').eq('creator_id',id)),
    checked(db.from('creator_booking_settings').select('time_zone').eq('creator_id',id).maybeSingle()),
  ];
  const [suspension,notes,services,hours,bookingSettings]=await Promise.all(tasks);
  const metrics=[['Designs','designs','created_by'],['Posts','salon_posts','creator_id'],['Stories','stories','user_id'],['Followers','follows','following_id'],['Following','follows','user_id'],['Client bookings','bookings','client_id'],['Creator bookings','bookings','creator_id'],['Reports submitted','mobile_reports','reporter_id'],['Lab requests','generation_reservations','user_id']];
  // Follows use follower_id; no message contents or private Lab images are loaded.
  metrics[4][2]='follower_id';
  const activity=Object.fromEntries(await Promise.all(metrics.map(async([label,table,column])=>[label,await count(table,column,id)])));
  let authentication=null,usagePreference=null,privateNotes=null,labSubscription=null;
  if(identity.role==='owner'){
    labSubscription=await checked(db.rpc('lab_subscription_status',{p_user_id:id}));
    const r=await db.auth.admin.getUserById(id);
    if(r.error&&r.error.status!==404)throw new AdminError('Sign-in details could not load.',503);
    const u=r.data?.user;
    authentication=u?{email:u.email||null,phone:u.phone||null,email_confirmed_at:u.email_confirmed_at||null,phone_confirmed_at:u.phone_confirmed_at||null,last_sign_in_at:u.last_sign_in_at||null,created_at:u.created_at,providers:[...new Set((u.identities||[]).map(i=>i.provider).filter(p=>['email','google','apple'].includes(p)))],authenticator_verified:!!u.factors?.some(f=>f.factor_type==='totp'&&f.status==='verified')}:null;
    privateNotes={health:await checked(db.from('client_health_notes').select('allergies,product_sensitivities,removal_needed,share_with_tech,updated_at').eq('user_id',id).maybeSingle()),booking:await checked(db.from('client_booking_notes').select('booking_notes,updated_at').eq('user_id',id).maybeSingle())};
    usagePreference=await checked(db.from('app_analytics_preferences').select('enabled,updated_at').eq('user_id',id).maybeSingle());
  }
  return {profile,suspension,notes,services,hours,bookingSettings,activity,authentication,usagePreference,privateNotes,labSubscription};
}
