import { serviceClient as db } from '@/lib/auth';
import { AdminError } from './auth';
import { validateHome } from './home';
import { adminMediaPreview } from './media';
import { userDirectory,userDetails } from './users';
import { pinterestAdminGet, pinterestAdminPost } from '@/lib/pinterest/connection';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idCheck = id => {
  if (!uuid.test(id || '')) throw new AdminError('Invalid record.');
  return id;
};
async function checked(query) {
  const result = await query;
  if (result.error) throw new AdminError('Data could not load. Try again.', 503);
  return result.data;
}
async function identities(ids) {
  return ids.length ? checked(db.from('profiles_data').select('id,display_name,username,avatar_url,account_type').in('id', [...new Set(ids)])) : [];
}
function paging(params) {
  const page = Number(params.get('page') || 0);
  if (!Number.isInteger(page) || page < 0 || page > 10000) throw new AdminError('Invalid page.');
  return {
    start: page * 25,
    end: page * 25 + 25,
    page,
    q: (params.get('q') || '').replace(/[^\p{L}\p{N}_ @.-]/gu, '').slice(0, 100),
    filter: params.get('filter') || ''
  };
}
async function list(query, p) {
  const rows = await checked(query.range(p.start, p.end));
  return {
    items: rows.slice(0, 25),
    hasMore: rows.length > 25,
    page: p.page
  };
}
export async function adminGet(section, id, params, identity) {
  const p = paging(params);
  if (section === 'pinterest') return pinterestAdminGet(db, identity);
  if (section === 'overview') {
    const days=Number(params.get('days')||30);
    if(![7,30].includes(days))throw new AdminError('Choose a 7-day or 30-day range.');
    const r=await db.rpc('admin_analytics_overview',{p_actor:identity.user.id,p_days:days});
    if(r.error||!r.data)throw new AdminError('Overview is unavailable. Try again.',503);
    const summary = identity.role === 'moderator' ? null : await db.rpc('admin_lab_summary',{p_actor:identity.user.id});
    if(summary?.error)throw new AdminError('Subscription totals are unavailable.',503);
    return {...r.data,counts:{...r.data.counts,...(summary?.data?{subscribers:summary.data.subscribers}:{})},labPlan:summary?.data||null,environment:process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('atjwbdrvgljddedtwoqo')?'beta':'production'};
  }
  if (section === 'home') {
    const content=await checked(db.from('admin_home').select('draft,published,version,revision,published_at').single());
    const heroPreviews=Object.fromEntries(await Promise.all(content.draft.heroes.map(async h=>[h.imageUrl,await adminMediaPreview(db,h.imageUrl)])));
    return {...content,heroPreviews,owned:await checked(db.from('admin_content_designs').select('id,title,is_published,image_url').in('id',(await checked(db.from('admin_owned_designs').select('design_id').limit(100))).map(x=>x.design_id)).limit(100))};
  }
  if (section === 'integrations') return {
    items: [{
      name: 'Supabase',
      ready: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }, {
      name: 'Pinterest OAuth',
      ready: !!(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET && process.env.PINTEREST_TOKEN_KEY && process.env.PINTEREST_REDIRECT_URI)
    }, {
      name: 'Google Calendar',
      ready: !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_TOKEN_KEY)
    }, {
      name: 'Stripe deposits',
      ready: !!process.env.STRIPE_SECRET_KEY
    }, {
      name: 'Store credits',
      ready: !!process.env.REVENUECAT_SECRET_KEY
    }, {
      name: 'Recovery worker',
      ready: !!process.env.CRON_SECRET
    }],
    note: 'Readiness only. Credentials and provider payloads are never returned.'
  };
  if (section === 'team') {
    const rows = await checked(db.from('admin_staff').select('user_id,role,active,updated_at').order('updated_at', {
      ascending: false
    }));
    return {
      items: rows,
      profiles: await identities(rows.map(x => x.user_id))
    };
  }
  if (section === 'activity') {
    let q = db.from('admin_actions').select('id,actor_id,actor_role,action,target_id,reason,details,created_at').order('created_at', {
      ascending: false
    });
    if (p.q) q = q.ilike('reason', `%${p.q}%`);
    return list(q, p);
  }
  if (section === 'users') {
    if(id)return userDetails(identity,idCheck(id));
    const rows=await userDirectory(identity,{q:p.q,filter:p.filter,offset:p.start,limit:26});
    return {items:rows.slice(0,25),hasMore:rows.length>25,page:p.page};
  }
  if (section === 'content') {
    const type = params.get('type') || 'design';
    const table = {
      design: 'designs',
      post: 'salon_posts',
      story: 'stories',
      tag: 'tags'
    }[type];
    if (!table) throw new AdminError('Invalid content type.');
    if (type === 'tag') return {
      items: await checked(db.from('tags').select('id,name').order('name'))
    };
    let q = db.from(type === 'design' ? 'admin_content_designs' : type === 'post' ? 'admin_content_posts' : type === 'story' ? 'admin_content_stories' : table).select(type === 'design' ? 'id,title,description,image_url,category,shape,length,is_published,created_by,created_at' : type === 'post' ? 'id,creator_id,body,created_at' : 'id,user_id,caption,created_at').order('created_at', {
      ascending: false
    });
    if (p.q) q = q.ilike(type === 'design' ? 'title' : type === 'post' ? 'body' : 'caption', `%${p.q}%`);
    if (id) q = q.eq('id', idCheck(id));
    const rows = await list(q, p);
    const owned = type === 'design' ? await checked(db.from('admin_owned_designs').select('design_id').in('design_id', rows.items.map(x => x.id))) : [];
    return {
      ...rows,
      type,
      ownedIds: owned.map(x => x.design_id),
      designTags: type === 'design' && rows.items.length ? await checked(db.from('design_tags').select('design_id,tag_id').in('design_id', rows.items.map(x => x.id))) : [],
      tags: type === 'design' ? await checked(db.from('tags').select('id,name').order('name')) : [],
      hidden: await checked(db.from('admin_moderation').select('target_id,hidden').eq('target_type', type).in('target_id', rows.items.map(x => x.id)))
    };
  }
  if (section === 'bookings') {
    let q = db.from('bookings').select('id,client_id,creator_id,service_id,status,booking_date,start_time,end_time,time_zone,starts_at,ends_at,deposit_paid,created_at').order('created_at', {
      ascending: false
    });
    if (id) q = q.eq('id', idCheck(id));
    if (['pending', 'confirmed', 'cancelled', 'declined', 'completed'].includes(p.filter)) q = q.eq('status', p.filter);
    if (p.q) {
      const matches = await checked(db.from('profiles_data').select('id').or(`username.ilike.%${p.q}%,display_name.ilike.%${p.q}%`).limit(100));
      if (!matches.length) return {
        items: [],
        hasMore: false,
        page: p.page,
        profiles: []
      };
      q = q.or(`client_id.in.(${matches.map(x => x.id).join(',')}),creator_id.in.(${matches.map(x => x.id).join(',')})`);
    }
    const rows = await list(q, p);
    return {
      ...rows,
      profiles: await identities(rows.items.flatMap(x => [x.client_id, x.creator_id])),
      services: rows.items.length ? await checked(db.from('services').select('id,name,price,deposit_amount,duration_minutes').in('id', rows.items.map(x => x.service_id).filter(Boolean))) : [],
      payments: rows.items.length ? await checked(db.from('order_payments').select('target_id,fulfilled,refunded,refund_status,needs_review').eq('kind', 'deposit').in('target_id', rows.items.map(x => x.id))) : [],
      notes: id ? await checked(db.from('admin_notes').select('id,body,actor_id,created_at').eq('target_type', 'booking').eq('target_id', id).order('created_at', {
        ascending: false
      }).limit(50)) : []
    };
  }
  if (section === 'lab') {
    let q = db.from('generation_reservations').select('id,user_id,status,created_at').order('created_at', {
      ascending: false
    });
    if (['reserved', 'released', 'completed'].includes(p.filter)) q = q.eq('status', p.filter);
    if (p.q && uuid.test(p.q)) q = q.eq('user_id', p.q);
    const result = await list(q, p);
    return {
      ...result,
      profiles: await identities(result.items.map(x => x.user_id))
    };
  }
  if (section === 'credits') {
    if (!id) {
      let q = db.from('profiles_data').select('id,display_name,username,credit_balance').order('created_at', {
        ascending: false
      });
      if (p.q) q = q.or(`display_name.ilike.%${p.q}%,username.ilike.%${p.q}%`);
      const rows=await list(q,p);
      return {...rows,plan:await checked(db.rpc('admin_lab_summary',{p_actor:identity.user.id})),subscriptions:Object.fromEntries(await Promise.all(rows.items.map(async u=>[u.id,await checked(db.rpc('lab_subscription_status',{p_user_id:u.id}))])))};
    }
    idCheck(id);
    return {
      profile: await checked(db.from('profiles_data').select('id,display_name,username,credit_balance').eq('id', id).single()),
      subscription: await checked(db.rpc('lab_subscription_status',{p_user_id:id})),
      purchases: await checked(db.from('mobile_store_transactions').select('store,environment,product_id,credits,purchased_at,granted,refunded').eq('user_id', id).order('purchased_at', {
        ascending: false
      }).limit(50)),
      corrections: await checked(db.from('admin_credit_corrections').select('id,delta,balance_after,reason,actor_id,created_at').eq('user_id', id).order('created_at', {
        ascending: false
      }).limit(50))
    };
  }
  if (section === 'reports') {
    if (id) return reportDetail(id);
    let q = db.from('mobile_reports').select('id,reporter_id,target_type,target_id,reason,status,assigned_to,created_at').order('created_at', {
      ascending: false
    });
    if (['open', 'reviewed', 'resolved'].includes(p.filter)) q = q.eq('status', p.filter);
    if (p.q) q = q.ilike('reason', `%${p.q}%`);
    return list(q, p);
  }
  throw new AdminError('Section unavailable.', 404);
}
async function reportDetail(id) {
  idCheck(id);
  const report = await checked(db.from('mobile_reports').select('id,reporter_id,target_type,target_id,reason,status,assigned_to,created_at').eq('id', id).single());
  let item,
    participants = [],
    attachment = null;
  if (report.target_type === 'message') {
    item = await checked(db.from('messages').select('id,content,sender_id,conversation_id,image_path,design_id,created_at').eq('id', report.target_id).maybeSingle());
    if (item) {
      const c = await checked(db.from('conversations').select('client_id,creator_id').eq('id', item.conversation_id).maybeSingle());
      participants = await identities(c ? [c.client_id, c.creator_id] : []);
      if (item.image_path) {
        const r = await db.storage.from('mobile-uploads').createSignedUrl(item.image_path, 60);
        attachment = r.data?.signedUrl || null;
      }
      delete item.conversation_id;
      delete item.image_path;
    }
  } else {
    const spec = {
      profile: ['profiles_data', 'id,display_name,username,avatar_url,bio'],
      design: ['designs', 'id,title,description,image_url,created_by'],
      post: ['salon_posts', 'id,body,creator_id'],
      story: ['stories', 'id,caption,user_id']
    }[report.target_type];
    item = spec ? await checked(db.from(spec[0]).select(spec[1]).eq('id', report.target_id).maybeSingle()) : null;
  }
  return {
    report,
    item,
    participants,
    attachment,
    moderation: await checked(db.from('admin_moderation').select('hidden').eq('target_type', report.target_type).eq('target_id', report.target_id).maybeSingle()),
    notes: await checked(db.from('admin_notes').select('id,body,actor_id,created_at').eq('target_type', 'report').eq('target_id', id).order('created_at', {
      ascending: false
    }).limit(50))
  };
}
export async function adminPost(section, id, body, identity, request) {
  if (section === 'pinterest') return pinterestAdminPost(db, identity, body, request);
  if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 1000) throw new AdminError('Enter a reason of 5–1,000 characters.');
  let action;
  let data = {};
  let target = id ? idCheck(id) : null;
  if (section === 'users' && body.action === 'suspend' && identity.role === 'owner') {
    action = 'suspend';
    data = {
      suspended: body.suspended
    };
    if (typeof body.suspended !== 'boolean') throw new AdminError('Invalid suspension.');
  } else if (['users', 'bookings', 'reports'].includes(section) && body.action === 'note') {
    action = 'note';
    data = {
      type: {
        users: 'user',
        bookings: 'booking',
        reports: 'report'
      }[section],
      body: body.body
    };
  } else if (section === 'credits') {
    action = 'credits';
    if (!Number.isInteger(body.delta) || !body.delta || Math.abs(body.delta) > 10000 || !uuid.test(body.key || '')) throw new AdminError('Enter an integer credit change and a valid request key.');
    data = {
      delta: body.delta,
      key: body.key
    };
  } else if (section === 'team') {
    action = 'staff';
    data = {
      role: body.role,
      active: body.active
    };
  } else if (section === 'reports') {
    action = body.action === 'moderate' ? 'moderate' : 'report';
    data = action === 'moderate' ? {
      hidden: body.hidden
    } : {
      status: body.status,
      assignedTo: body.assignedTo
    };
    if (action === 'moderate' && typeof body.hidden !== 'boolean') throw new AdminError('Invalid moderation state.');
  } else if (section === 'home') {
    if (!Number.isInteger(body.version)) throw new AdminError('Reload the latest draft.');
    action = body.action === 'publish' ? 'home-publish' : 'home-draft';
    data = {
      version: body.version
    };
    if (action === 'home-draft') data.content = validateHome(body.content);
    const content = action === 'home-draft' ? data.content : (await checked(db.from('admin_home').select('draft').single())).draft;
    validateHome(content);
    if (content.featuredDesignIds.length) {
      const owned = await checked(db.from('admin_owned_designs').select('design_id').in('design_id', content.featuredDesignIds));
      if (owned.length !== content.featuredDesignIds.length) throw new AdminError('Featured designs must be owned by LaQue.');
      if (action === 'home-publish') {
        const published = await checked(db.from('admin_content_designs').select('id').in('id', content.featuredDesignIds).eq('is_published', true));
        if (published.length !== content.featuredDesignIds.length) throw new AdminError('Publish each featured design before publishing Home.');
      }
    }
  } else if (section === 'content' && body.action === 'tag') {
    action = 'tag';
    data = {
      name: body.name
    };
  } else if (section === 'content') {
    action = body.action === 'create' ? 'own-design' : 'design';
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 240 || typeof body.published !== 'boolean') throw new AdminError('Enter a title and publication state.');
    if (action === 'own-design') {
      validateHome({
        heroes: [{
          id: 'image',
          imageUrl: body.imageUrl,
          alt: 'Design',
          title: 'Design',
          rotate: 0
        }],
        featuredDesignIds: [],
        announcements: []
      });
    }
    data = {
      title: body.title.trim(),
      description: String(body.description || '').slice(0, 4000),
      category: String(body.category || '').slice(0, 60),
      shape: String(body.shape || '').slice(0, 60),
      length: String(body.length || '').slice(0, 60),
      published: body.published,
      imageUrl: body.imageUrl,
      tags: body.tags || []
    };
  } else throw new AdminError('This operation is not permitted.', 403);
  const result = await db.rpc('admin_mutate', {
    p_actor: identity.user.id,
    p_action: action,
    p_target: target,
    p_reason: body.reason.trim(),
    p_data: data
  });
  if (result.error) {
    const message = result.error.message || '';
    if (message.includes('CONFLICT')) throw new AdminError('Another editor changed this record. Reload before saving.', 409, 'EDIT_CONFLICT');
    if (message.includes('FORBIDDEN')) throw new AdminError('Your access changed. Sign in again.', 403);
    if (message.includes('INSUFFICIENT')) throw new AdminError('The correction would make the balance negative.');
    throw new AdminError('The change was rejected. Check the record and retry.', 400);
  }
  return {
    ok: true,
    result: result.data
  };
}
