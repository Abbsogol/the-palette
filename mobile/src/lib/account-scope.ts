export class AccountChangedError extends Error {
  constructor() {
    super("Your account changed. Please try again.");
    this.name = "AccountChangedError";
  }
}
export type AccountTicket = { id: string | null; epoch: number };
export class AccountScope {
  private id: string | null = null;
  private epoch = 0;
  private cleanup = new Set<() => void>();
  capture(): AccountTicket {
    return { id: this.id, epoch: this.epoch };
  }
  isCurrent(ticket: AccountTicket) {
    return ticket.id === this.id && ticket.epoch === this.epoch;
  }
  assert(ticket: AccountTicket) {
    if (!this.isCurrent(ticket)) throw new AccountChangedError();
  }
  change(id: string | null, force = false) {
    if (id === this.id && !force) return;
    this.epoch++;
    this.id = id;
    for (const dispose of this.cleanup) dispose();
    this.cleanup.clear();
  }
  onChange(dispose: () => void) {
    this.cleanup.add(dispose);
    return () => {
      this.cleanup.delete(dispose);
    };
  }
}
export const accountScope = new AccountScope();
