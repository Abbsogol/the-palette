import { vi } from 'vitest'

export const user = { id: 'user-a', email: 'user-a@example.invalid' }
export const ok = data => ({ data, error: null })
export const jsonRequest = (body, headers = {}) => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})

// Models the SDK query boundary, never SQL/RLS behavior. Unknown operations
// fail loudly so a newly introduced production query requires a test fixture.
export function database(resolve, rpc = async () => { throw new Error('Unexpected RPC') }) {
  const calls = []
  return {
    calls,
    from: vi.fn(table => {
      const query = { table, operation: 'select', values: null, filters: [] }
      calls.push(query)
      const run = () => Promise.resolve().then(() => resolve(query))
      const chain = {
        select(columns) { query.columns = columns; return chain },
        insert(values) { query.operation = 'insert'; query.values = values; return chain },
        update(values) { query.operation = 'update'; query.values = values; return chain },
        delete() { query.operation = 'delete'; return chain },
        eq(k, v) { query.filters.push(['eq', k, v]); return chain },
        is(k, v) { query.filters.push(['is', k, v]); return chain },
        in(k, v) { query.filters.push(['in', k, v]); return chain },
        order() { return chain }, limit() { return chain },
        single: run, maybeSingle: run,
        then(yes, no) { return run().then(yes, no) },
      }
      return chain
    }),
    rpc: vi.fn(rpc),
  }
}

export function generationEnvironment({ balance = 1, failFetch = false } = {}) {
  const state = { balance, generated: 0, charged: 0, freeRegenUsed: false, inserts: 0 }
  const client = database(q => {
    if (q.table === 'profiles_data') return ok({ credit_balance: state.balance })
    if (q.table === 'nail_lab_generations' && q.operation === 'update') {
      if (q.values.free_regen_used && state.freeRegenUsed) return ok(null)
      state.freeRegenUsed = q.values.free_regen_used
      return ok({ id: 'parent-a' })
    }
    if (q.table === 'nail_lab_generations' && q.operation === 'insert') return ok({ id: `generation-${++state.inserts}` })
    throw new Error(`Unexpected query: ${q.table} ${q.operation}`)
  }, async name => {
    if (name === 'decrement_credits') {
      // The deployed void RPC silently updates zero rows at zero balance.
      // Model that contract; an insufficient-balance error would hide the race.
      if (state.balance > 0) { state.balance--; state.charged++ }
      return ok(null)
    }
    if (name === 'increment_credits') { state.balance++; return ok(null) }
    throw new Error(`Unexpected RPC: ${name}`)
  })
  client.storage = { from: vi.fn(() => ({
    upload: vi.fn(async () => ok(null)),
    getPublicUrl: name => ({ data: { publicUrl: `https://storage.invalid/nail-lab/${name}` } }),
    createSignedUrl: async () => ok({ signedUrl: 'https://storage.invalid/signed' }),
  })) }
  const fetch = vi.fn(async () => {
    state.generated++
    if (failFetch) throw new TypeError('Simulated upstream connection failure')
    return { ok: true, json: async () => ({ data: [{ b64_json: 'aW1hZ2U=' }] }) }
  })
  return { state, client, fetch }
}
