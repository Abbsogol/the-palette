import { getSessionUser } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const {
    id,
    conversationId,
    content,
    designId = null,
    imagePath = null,
  } = await request.json().catch(() => ({}));
  if (
    !uuidPattern.test(id || "") ||
    !uuidPattern.test(conversationId || "") ||
    typeof content !== "string" ||
    !content.trim() ||
    content.length > 4000 ||
    (designId !== null && !uuidPattern.test(designId)) ||
    (imagePath !== null &&
      (typeof imagePath !== "string" || imagePath.length > 300))
  )
    return mobileJson({ error: "Invalid message" }, 400);
  const client = mobileUserClient(request),
    message = {
      id,
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      design_id: designId,
      image_path: imagePath,
    };
  const { data, error } = await client
    .from("messages")
    .insert(message)
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await client
      .from("messages")
      .select("*")
      .eq("id", id)
      .eq("sender_id", user.id)
      .single();
    if (
      existing &&
      ["conversation_id", "content", "design_id", "image_path"].every(
        (key) => existing[key] === message[key],
      )
    )
      return mobileJson({ message: existing });
    return mobileJson(
      { error: "This message identity was already used." },
      409,
    );
  }
  return error || !data
    ? mobileJson(
        {
          error:
            "Message was not sent. Check your connection and conversation access, then retry.",
        },
        403,
      )
    : mobileJson({ message: data });
}
