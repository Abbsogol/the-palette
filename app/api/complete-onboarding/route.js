import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    display_name, phone_number, location, bio,
    nail_shape, nail_length, nail_colors, nail_finishes, nail_techniques,
    occasions, budget_range, allergies, product_sensitivities, removal_needed,
    specialties, age_confirmed, privacy_accepted,
  } = await request.json().catch(() => ({}))

  const str = (val, max) => (typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : null)
  const arr = (val, max) => (Array.isArray(val) ? val.filter(v => typeof v === 'string').slice(0, max) : [])

  const { data: completed, error } = await supabase.rpc('complete_onboarding', {
    p_user_id: user.id,
    p_fields: {
    age_confirmed: age_confirmed === true,
    privacy_accepted: privacy_accepted === true,
    display_name: str(display_name, 100),
    phone_number: str(phone_number, 30),
    location: str(location, 100),
    bio: str(bio, 1000),
    nail_shape: str(nail_shape, 50),
    nail_length: str(nail_length, 50),
    nail_colors: arr(nail_colors, 20),
    nail_finishes: arr(nail_finishes, 20),
    nail_techniques: arr(nail_techniques, 20),
    occasions: arr(occasions, 20),
    budget_range: str(budget_range, 50),
    allergies: str(allergies, 500),
    product_sensitivities: arr(product_sensitivities, 20),
    removal_needed: !!removal_needed,
    specialties: arr(specialties, 20),
    },
  })

  if (error) {
    if (error.message?.includes('AGE_AND_PRIVACY_CONFIRMATION_REQUIRED')) return Response.json({error:'Confirm you are 18 or older and acknowledge the Privacy Policy.'},{status:400})
    console.error('complete-onboarding error:', error)
    return Response.json({ error: 'Failed to complete onboarding' }, { status: error.code === 'P0002' ? 404 : 500 })
  }

  return Response.json({ ok: true, alreadyCompleted: !completed })
}
