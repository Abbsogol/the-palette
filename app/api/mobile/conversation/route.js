import { getSessionUser } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { creatorId } = await request.json().catch(() => ({}));
  if (!uuidPattern.test(creatorId || "") || creatorId === user.id)
    return mobileJson({ error: "Choose another creator" }, 400);
  const client = mobileUserClient(request);
  const { data: creator, error: creatorError } = await client
    .from("profiles")
    .select("id,account_type")
    .eq("id", creatorId)
    .single();
  if (
    creatorError ||
    !creator ||
    !["creator", "nail_artist", "salon"].includes(creator.account_type)
  )
    return mobileJson({ error: "Creator unavailable" }, 404);
  const { data: existing, error: existingError } = await client
    .from("conversations")
    .select("id")
    .eq("client_id", user.id)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (existingError)
    return mobileJson({ error: "Unable to open conversation" }, 503);
  if (existing) return mobileJson({ conversationId: existing.id });
  const { data, error } = await client
    .from("conversations")
    .insert({ client_id: user.id, creator_id: creatorId })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: concurrent } = await client
      .from("conversations")
      .select("id")
      .eq("client_id", user.id)
      .eq("creator_id", creatorId)
      .single();
    if (concurrent) return mobileJson({ conversationId: concurrent.id });
  }
  return error || !data
    ? mobileJson({ error: "Messaging is unavailable for this creator" }, 403)
    : mobileJson({ conversationId: data.id });
}
