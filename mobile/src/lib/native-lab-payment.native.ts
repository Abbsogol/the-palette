import { initStripe, initPaymentSheet, presentPaymentSheet, handleURLCallback } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { accountScope, type AccountTicket } from './account-scope';
export type NativeLabPayment = { id: string; sandbox: true; clientSecret: string | null; publishableKey: string };
export async function presentNativeLabPayment(payment: NativeLabPayment, ticket: AccountTicket) {
  accountScope.assert(ticket);
  if (!payment.clientSecret) return { cancelled: false };
  if (payment.sandbox !== true || !/^pk_test_[A-Za-z0-9]+$/.test(payment.publishableKey) || !/^pi_\w+_secret_\w+$/.test(payment.clientSecret)) throw new Error('Unexpected payment configuration.');
  await initStripe({ publishableKey: payment.publishableKey, urlScheme: Constants.appOwnership === 'expo' ? Linking.createURL('/--/') : Linking.createURL('') });
  accountScope.assert(ticket);
  const callback = Linking.addEventListener('url', ({ url }) => { void handleURLCallback(url); });
  try {
    const initialized = await initPaymentSheet({
      merchantDisplayName: 'LaQue · WEACTIVATE', paymentIntentClientSecret: payment.clientSecret,
      returnURL: Linking.createURL('billing'), allowsDelayedPaymentMethods: false,
      appearance: { colors: { primary: '#ed467b', background: '#330613', componentBackground: '#4b1425', componentBorder: '#a86178', componentText: '#ffffff', primaryText: '#ffffff', secondaryText: '#edc0d0', placeholderText: '#c793a7', icon: '#edc0d0', error: '#ff879c' }, shapes: { borderRadius: 18 } },
    });
    accountScope.assert(ticket);
    if (initialized.error) throw new Error('The payment sheet could not open. Check purchases and try again.');
    const outcome = await presentPaymentSheet();
    accountScope.assert(ticket);
    if (outcome.error?.code === 'Canceled') return { cancelled: true };
    if (outcome.error) throw new Error('Payment could not be confirmed. Check purchases before trying again.');
    return { cancelled: false };
  } finally { callback.remove(); }
}
