import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Unexpected network request: inject a service double in this test')
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
