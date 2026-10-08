export async function readMobilePushStatus(
  client,
  userId,
  installationId,
  now = Date.now(),
) {
  const { data, error } = await client
    .from("mobile_push_registrations")
    .select("enabled,expires_at")
    .eq("user_id", userId)
    .eq("installation_id", installationId)
    .maybeSingle();
  if (error) throw error;
  return { enabled: !!data?.enabled && Date.parse(data.expires_at) > now };
}
