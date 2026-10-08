export function safeReturnPath(value: unknown): string {
  if (
    typeof value === "string" &&
    [
      "/saved",
      "/collections",
      "/lab",
      "/messages",
      "/profile",
      "/appointments",
      "/billing",
      "/search",
      "/notifications",
      "/creator-onboarding",
      "/story/new",
      "/services",
      "/availability",
      "/calendar-connect",
      "/portfolio",
      "/profile-edit",
      "/profile-settings",
      "/profile-favorites",
      "/generation-history",
    ].includes(value)
  )
    return value;
  if (
    typeof value !== "string" ||
    !/^\/(?:design|creator|book|booking|conversation|story|collection)\/[0-9a-f-]{36}(?:\?[a-zA-Z0-9=&%-]*)?$/.test(
      value,
    )
  )
    return "/";
  return value;
}
export function parseAuthLink(
  url: string,
  scheme: string,
): { code: string; recovery: boolean; flowId?: string } {
  const parsed = new URL(url);
  if (
    parsed.protocol !== `${scheme}:` ||
    `${parsed.host}${parsed.pathname}` !== "auth/callback" ||
    parsed.hash
  )
    throw new Error("This sign-in link is not valid for this app.");
  if (parsed.searchParams.has("error"))
    throw Object.assign(
      new Error(
        parsed.searchParams.get("error_description") ||
          "The sign-in link has expired. Request another link.",
      ),
      { code: parsed.searchParams.get("error_code") },
    );
  const code = parsed.searchParams.get("code");
  if (!code || code.length > 2000)
    throw new Error("The sign-in link is incomplete. Request another link.");
  const flowId = parsed.searchParams.get("sb_flow_id");
  if (flowId !== null && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId))
    throw new Error("This sign-in link is not valid for this app.");
  return {
    code,
    recovery: parsed.searchParams.get("flow") === "recovery",
    ...(flowId ? { flowId } : {}),
  };
}
export function notificationPath(data: Record<string, unknown>): string | null {
  if (
    typeof data.id !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.id)
  )
    return null;
  if (data.kind === "message") return `/conversation/${data.id}`;
  if (data.kind === "booking") return `/booking/${data.id}`;
  return null;
}

export function protectedReturnPath(
  path: string,
  params: Record<string, unknown>,
) {
  const safe = safeReturnPath(path);
  if (!safe.startsWith("/book/")) return safe;
  const query = new URLSearchParams();
  for (const key of ["designId", "rescheduledFrom"]) {
    const value = params[key];
    if (
      typeof value === "string" &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    )
      query.set(key, value);
  }
  return query.toString() ? `${safe}?${query}` : safe;
}
