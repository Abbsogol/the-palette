import { accountScope, type AccountTicket } from "./account-scope";
import { secureStorage } from "./secure-storage";
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => undefined);
  return next;
}
const key = (id: string) => `laque.pending.${id}`;
export function readPending<T>(
  name: string,
  ticket = accountScope.capture(),
): Promise<T | null> {
  return serial(async () => {
    accountScope.assert(ticket);
    if (!ticket.id) return null;
    const raw = await secureStorage.getItem(key(ticket.id));
    accountScope.assert(ticket);
    return raw ? (JSON.parse(raw)[name] ?? null) : null;
  });
}
export function writePending(
  name: string,
  value: unknown,
  ticket: AccountTicket,
) {
  return serial(async () => {
    accountScope.assert(ticket);
    if (!ticket.id) throw new Error("Sign in to continue.");
    const raw = await secureStorage.getItem(key(ticket.id));
    accountScope.assert(ticket);
    const data = raw ? JSON.parse(raw) : {};
    if (value === null) delete data[name];
    else data[name] = value;
    await secureStorage.setItem(key(ticket.id), JSON.stringify(data));
  });
}
export function clearPending(userId: string) {
  return serial(() => secureStorage.removeItem(key(userId)));
}
