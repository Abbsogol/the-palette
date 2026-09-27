// Shared presence singleton for the online-users room. Exactly one channel
// may exist per topic: supabase-js hands back the same instance for a topic,
// and adding presence callbacks after subscribe() throws — so the channel is
// created once here with its listeners attached BEFORE subscribing, and every
// consumer reads through the store instead of touching the channel.
import { supabase } from '@/lib/supabase'

let channel = null
let state = {}
const listeners = new Set()

const broadcast = () => {
  state = channel?.presenceState() || {}
  listeners.forEach(l => l(state))
}

// Idempotent: safe to call from anywhere that knows the signed-in user.
export function startPresence(userId) {
  if (channel || !userId) return
  channel = supabase.channel('online-users', { config: { presence: { key: userId } } })
  channel
    .on('presence', { event: 'sync' }, broadcast)
    .on('presence', { event: 'join' }, broadcast)
    .on('presence', { event: 'leave' }, broadcast)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() })
    })
}

// Subscribe to presence state; fires immediately with the current map.
// Returns an unsubscribe function. Never touches the channel itself.
export function onPresence(cb) {
  listeners.add(cb)
  cb(state)
  return () => listeners.delete(cb)
}
