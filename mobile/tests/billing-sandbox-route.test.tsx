import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BillingScreen from '../src/app/billing';
import { api } from '../src/lib/api';
import { storePackages } from '../src/lib/purchases';
import * as WebBrowser from 'expo-web-browser';
import { presentNativeLabPayment } from '../src/lib/native-lab-payment';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { canGoBack: () => false, replace: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }) }));
jest.mock('../src/lib/native-lab-payment', () => ({ presentNativeLabPayment: jest.fn().mockResolvedValue({ cancelled: false }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'd2dd01b4-1d4e-4c65-a22c-eef8baa6e8ff' }));
jest.mock('../src/components/ui', () => ({ RequireAuth: ({ children }: {children: React.ReactNode}) => children }));
jest.mock('../src/lib/config', () => ({ environment: { appEnv: 'beta', apiUrl: 'https://laque-beta.vercel.app' } }));
jest.mock('../src/lib/api', () => ({ api: jest.fn() }));
jest.mock('../src/lib/purchases', () => ({ storePackages: jest.fn(), buyPackage: jest.fn(), restoreStorePurchases: jest.fn() }));
jest.mock('../src/lib/account-scope', () => ({ accountScope: { capture: () => ({ id: 'owner', epoch: 1 }), assert: jest.fn(), isCurrent: () => true } }));
jest.mock('../src/lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'owner' } }, epoch: 1 }),
  queryClient: { invalidateQueries: jest.fn() },
  useAccountQuery: (key: unknown[], query: () => Promise<unknown>, enabled = true) =>
    jest.requireActual('@tanstack/react-query').useQuery({ queryKey: key, queryFn: query, enabled }),
}));

const billing = {
  credits: 0, catalog: [], configured: false, needsReview: false, pendingPurchases: [],
  canSubscribe: true, subscription: { active: false, monthlyRemaining: 0, purchasedTokens: 3, renewsAt: null, store: null },
  history: { items: [], hasMore: false },
  stripeLab: { sandbox: true, enabled: true, pending: [], subscription: null, needsReview: false, verifiedAt: null,
    packages: [{ id: 'monthly', kind: 'subscription', credits: 15, price: '$5' }, { id: 'tokens30', kind: 'credits', credits: 30, price: '$10' }] },
};

test('sandbox checkout becomes usable while the disabled native-products query stays pending', async () => {
  jest.mocked(api).mockImplementation(async (path) => path === '/mobile/billing' ? billing : { url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', pending: true } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  try {
    await render(<QueryClientProvider client={client}><BillingScreen /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subscribe · $5/month' })).toBeEnabled());
    expect(client.getQueryState(['store-packages'])).toMatchObject({ status: 'pending', fetchStatus: 'idle' });
    expect(storePackages).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Loading subscription and token prices')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Subscribe · $5/month' }));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_fixture'));
    expect(api).toHaveBeenCalledWith('/mobile/billing/stripe', { action: 'checkout', id: 'd2dd01b4-1d4e-4c65-a22c-eef8baa6e8ff', package: 'monthly' });
    await waitFor(() => expect(screen.getByText('Your subscription and design-token balance are up to date.')).toBeTruthy());
  } finally { client.clear(); }
});


test('native sandbox opens PaymentSheet and verifies server state without opening a website', async () => {
  jest.clearAllMocks();
  jest.mocked(presentNativeLabPayment).mockResolvedValue({cancelled:false});
  const native = {...billing, stripeLab: {...billing.stripeLab, native:true}};
  const payment={id:'d2dd01b4-1d4e-4c65-a22c-eef8baa6e8ff',sandbox:true,clientSecret:'pi_fixture_secret_fixture',publishableKey:'pk_test_fixture'};
  jest.mocked(api).mockImplementation(async path => path==='/mobile/billing'?native:path==='/mobile/billing/stripe/native'?payment:{pending:false} as never);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  try {
    await render(<QueryClientProvider client={client}><BillingScreen/></QueryClientProvider>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Subscribe · $5/month'})).toBeEnabled());
    await fireEvent.press(screen.getByRole('button',{name:'Subscribe · $5/month'}));
    await waitFor(()=>expect(presentNativeLabPayment).toHaveBeenCalledWith(payment,{id:'owner',epoch:1}));
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(storePackages).not.toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/mobile/billing/stripe/native',{action:'payment',id:payment.id,package:'monthly'});
    await waitFor(()=>expect(screen.getByText('Your subscription and design-token balance are up to date.')).toBeTruthy());
  } finally {client.clear()}
});

test('an existing Stripe subscription keeps Stripe cancellation when new checkout falls back to the store', async () => {
  jest.clearAllMocks();
  const previous=__DEV__;
  Object.defineProperty(globalThis,'__DEV__',{value:false,configurable:true,writable:true});
  const state={...billing,stripeLab:{...billing.stripeLab,enabled:false,native:true},subscription:{...billing.subscription,active:true,monthlyRemaining:15,store:'STRIPE_LAB'}};
  jest.mocked(api).mockImplementation(async path=>path==='/mobile/billing'?state:{pending:false} as never);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  try {
    await render(<QueryClientProvider client={client}><BillingScreen/></QueryClientProvider>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Cancel renewal'})).toBeEnabled());
    await fireEvent.press(screen.getByRole('button',{name:'Cancel renewal'}));
    await fireEvent.press(screen.getByRole('button',{name:'Confirm cancellation'}));
    await waitFor(()=>expect(api).toHaveBeenCalledWith('/mobile/billing/stripe',{action:'cancelSubscription'}));
    expect(presentNativeLabPayment).not.toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  } finally {client.clear();Object.defineProperty(globalThis,'__DEV__',{value:previous,configurable:true,writable:true});}
});
