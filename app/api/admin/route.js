// This route is no longer used — admin panel talks directly to Supabase
export async function POST() {
  return Response.json({ error: 'Not used' }, { status: 404 })
}
