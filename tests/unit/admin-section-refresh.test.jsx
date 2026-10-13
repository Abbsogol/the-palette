// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
const auth = vi.hoisted(() => ({ listener: null }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }),
  onAuthStateChange: callback => { auth.listener = callback; return { data: { subscription: { unsubscribe() {} } } }; }
} } }));
import AdminPage from '@/app/admin/page';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps the chosen News section during session refresh and shows one pagination control', async () => {
  window.history.replaceState(null, '', '/admin?section=rewards');
  const fetcher = vi.fn(async url => ({ ok: true, json: async () => String(url).endsWith('/identity')
    ? { mfa: true, role: 'owner', permissions: ['updates','rewards'] }
    : { items: [], page: 0, hasMore: false, enabled: false, countryCodes: ['IN','TR'] }
  }));
  vi.stubGlobal('fetch', fetcher);
  render(<AdminPage />);
  await screen.findByRole('heading', { name: 'Rewards', level: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Official Updates', exact: true }));
  await screen.findByRole('region', { name: 'Official Updates management' });
  expect(new URL(window.location.href).searchParams.get('section')).toBe('updates');
  const before = fetcher.mock.calls.filter(([url]) => String(url).endsWith('/identity')).length;
  auth.listener('TOKEN_REFRESHED');
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/identity')).length).toBeGreaterThan(before));
  expect(screen.getByRole('heading', { name: 'Official Updates', level: 1 })).toBeDefined();
  expect(screen.getAllByRole('button', { name: 'Previous', exact: true })).toHaveLength(1);
});
