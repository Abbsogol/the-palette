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
  } = await request.json()

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
    display_name: display_name || null,
    phone_number: phone_number || null,
    location: location || null,
    bio: bio || null,
    nail_shape: nail_shape || null,
    nail_length: nail_length || null,
    nail_colors: nail_colors || [],
    nail_finishes: nail_finishes || [],
    nail_techniques: nail_techniques || [],
    occasions: occasions || [],
    budget_range: budget_range || null,
    allergies: allergies || null,
    product_sensitivities: product_sensitivities || [],
    removal_needed: !!removal_needed,
    specialties: specialties || [],
    credit_balance: credits,
    onboarding_complete: true,
  }).eq('id', user.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
