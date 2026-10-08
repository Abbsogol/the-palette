import { createClient } from "@supabase/supabase-js";
export function mobileUserClient(request) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: request.headers.get("authorization") || "" },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
export const mobileJson = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
