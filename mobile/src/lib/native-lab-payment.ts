// Metro selects .native on iOS/Android. Keep web previews free of native SDK calls.
import type { AccountTicket } from './account-scope';
export type NativeLabPayment = { id: string; sandbox: true; clientSecret: string | null; publishableKey: string };
export async function presentNativeLabPayment(_payment: NativeLabPayment, _ticket: AccountTicket): Promise<{cancelled: boolean}> {
  throw new Error('Open the connected iPhone or Android app to use in-app sandbox payments.');
}
