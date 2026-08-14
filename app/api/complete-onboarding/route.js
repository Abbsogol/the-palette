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
    specialties,
  } = await request.json().catch(() => ({}))

  const str = (val, max) => (typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : null)
  const arr = (val, max) => (Array.isArray(val) ? val.filter(v => typeof v === 'string').slice(0, max) : [])

  // profiles_data, not the profiles view — credit_balance/onboarding_complete
  // are masked/protected behind auth.uid() = id in the view for non-service-role callers.
  const { data: existing, error: readError } = await supabase
    .from('profiles_data')
    .select('account_type, onboarding_complete')
    .eq('id', user.id)
    .single()

  if (readError || !existing) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  if (existing.onboarding_complete) {
    return Response.json({ ok: true, alreadyCompleted: true })
  }

  const credits = (existing.account_type === 'creator' || existing.account_type === 'salon') ? 5 : 3

  const { error } = await supabase.from('profiles_data').update({
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
    credit_balance: credits,
    onboarding_complete: true,
  }).eq('id', user.id)

  if (error) {
    console.error('complete-onboarding error:', error)
    return Response.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
