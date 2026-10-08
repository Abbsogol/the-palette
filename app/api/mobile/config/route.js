export async function GET() {
  const environment = process.env.MOBILE_ENVIRONMENT;
  let host;
  try {
    host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return Response.json(
      { error: "Mobile services are not configured" },
      { status: 503 },
    );
  }
  if (
    !["development", "beta"].includes(environment) ||
    host === "faunikvhoommbebsmevg.supabase.co" ||
    !process.env.MOBILE_SUPABASE_PROJECT_REF
  )
    return Response.json(
      { error: "Isolated mobile services have not been verified" },
      { status: 503 },
    );
  if (
    host.endsWith(".supabase.co") &&
    host !== `${process.env.MOBILE_SUPABASE_PROJECT_REF}.supabase.co`
  )
    return Response.json(
      { error: "Backend database identity mismatch" },
      { status: 503 },
    );
  if (
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")
  )
    return Response.json(
      { error: "Beta requires sandbox payments" },
      { status: 503 },
    );
  return Response.json(
    {
      environment,
      projectRef: process.env.MOBILE_SUPABASE_PROJECT_REF,
      contractVersion: 1,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
