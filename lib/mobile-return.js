export function depositReturnContext(value) {
  if (value === undefined || value === "web") return "web";
  if (!["laque", "laque-dev"].includes(value))
    throw new Error("Invalid mobile return context");
  const allowed = (process.env.MOBILE_RETURN_SCHEMES || "")
    .split(",")
    .map((s) => s.trim());
  if (!allowed.includes(value))
    throw new Error("Mobile return context is not enabled");
  return value;
}
export function depositReturnUrls(attempt, bookingId, context) {
  if (!context || context === "web")
    return {
      success_url: `${attempt.base_url}/appointments/deposit-success?booking=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${attempt.base_url}/appointments`,
    };
  // Checkout requires an HTTPS return. This page presents an explicit app link;
  // neither the page nor the app grants payment credit from the URL.
  const base = `${attempt.base_url}/mobile-return?context=${context}&booking=${bookingId}`;
  return {
    success_url: `${base}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: base,
  };
}
