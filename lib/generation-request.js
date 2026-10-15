// Keep the user intent across network failures and page reloads. Local storage
// contains only the builder input/id, scoped to the signed-in account.
export async function requestGeneration(session, payload, storage = window.localStorage) {
  if (!session?.access_token || !session?.user?.id) throw new Error('Sign in to generate a design.')
  const key = `laque:generation:${session.user.id}`
  const fingerprint = JSON.stringify(payload)
  let intent
  try { intent = JSON.parse(storage.getItem(key)) } catch { /* discard corrupt local data */ }
  if (!intent || intent.fingerprint !== fingerprint) intent = { requestId: crypto.randomUUID(), fingerprint }
  // Fail before spending if the browser cannot persist a retry token.
  storage.setItem(key, JSON.stringify(intent))
  const response = await fetch('/api/generate-nail-design', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...payload, requestId: intent.requestId }),
  })
  const result = await response.json()
  if (response.status === 410 || response.status === 409 || response.status === 400 || response.status === 402 || response.status === 403) storage.removeItem(key)
  if (!response.ok || response.status === 202) throw new Error(result.error || 'Generation failed. Retry to check the same attempt.')
  storage.removeItem(key)
  return result
}

export function hasPendingGeneration(userId) {
  if (!userId || typeof window === 'undefined') return false
  try { return !!JSON.parse(window.localStorage.getItem(`laque:generation:${userId}`))?.requestId } catch { return false }
}
