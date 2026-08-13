export interface IssuedCard {
  id: string;
  last4: string;
  expMonth: number;
  expYear: number;
  brand: string;
  /** Present only for real issuers that return a PAN on creation. */
  number?: string;
  cvc?: string;
}

export interface EmailForwarder {
  readonly kind: "email";
  readonly live: boolean;
  /** Forward one received message to the resolved destination. */
  forward(msg: {
    from: string;
    to: string;
    destination: string;
    subject: string;
    raw: Buffer | string;
  }): Promise<void>;
  /** Send a new message from an alias (used for reply-from-alias). */
  send(msg: { from: string; to: string; subject: string; text: string }): Promise<void>;
}

export interface PhoneProvider {
  readonly kind: "phone";
  readonly live: boolean;
  /** Provision (or reserve) a masked number that relays to `relayTo`. */
  provision(relayTo: string): Promise<{ number: string }>;
  /** Relay an inbound SMS to the user's real number. */
  relaySms(from: string, to: string, body: string, relayTo: string): Promise<void>;
}

export interface CardProvider {
  readonly kind: "card";
  readonly live: boolean;
  issue(opts: { monthlyLimit?: number; label?: string }): Promise<IssuedCard>;
  freeze(cardId: string): Promise<void>;
}

export interface Providers {
  email: EmailForwarder;
  phone: PhoneProvider;
  card: CardProvider;
}
