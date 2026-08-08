/**
 * Provider adapters.
 *
 * Real masking requires backend services that Veil deliberately does not bundle:
 *  - Email forwarding needs a mail provider (e.g. an inbound-parse webhook).
 *  - Phone masking needs a telephony provider (e.g. Twilio programmable voice/SMS).
 *  - Virtual cards need a regulated card-issuing/BaaS provider.
 *
 * These are the interfaces those integrations implement. The shipped default is
 * `LocalMockProvider`, which simulates the behavior entirely on-device so the app
 * is fully functional offline. Swapping in a real provider is a one-line change in
 * `getProvider()` — no UI or vault code needs to change.
 */

import type { Card } from "../lib/types";

export interface ProvisionedEmail {
  alias: string;
  forwardsTo: string;
}

export interface ProvisionedPhone {
  alias: string;
  relaysTo: string;
}

export interface EmailProvider {
  provisionAlias(alias: string, forwardTo: string): Promise<ProvisionedEmail>;
  revokeAlias(alias: string): Promise<void>;
}

export interface PhoneProvider {
  provisionNumber(alias: string, relayTo: string): Promise<ProvisionedPhone>;
  revokeNumber(alias: string): Promise<void>;
}

export interface CardProvider {
  issueCard(monthlyLimit?: number): Promise<Card>;
  freezeCard(cardNumber: string): Promise<void>;
}

export interface Provider {
  readonly name: string;
  /** True when this provider performs real routing vs. local simulation. */
  readonly live: boolean;
  email: EmailProvider;
  phone: PhoneProvider;
  card: CardProvider;
}

import { generateTestCard } from "../lib/generators";

/**
 * Fully offline provider. Aliases and numbers are recorded but no external
 * routing happens. Cards are Luhn-valid but non-chargeable test tokens.
 */
export class LocalMockProvider implements Provider {
  readonly name = "local-mock";
  readonly live = false;

  email: EmailProvider = {
    async provisionAlias(alias, forwardTo) {
      return { alias, forwardsTo: forwardTo };
    },
    async revokeAlias() {
      /* no-op locally */
    },
  };

  phone: PhoneProvider = {
    async provisionNumber(alias, relayTo) {
      return { alias, relaysTo: relayTo };
    },
    async revokeNumber() {
      /* no-op locally */
    },
  };

  card: CardProvider = {
    async issueCard(monthlyLimit) {
      const c = generateTestCard();
      return { ...c, monthlyLimit };
    },
    async freezeCard() {
      /* no-op locally */
    },
  };
}

let active: Provider = new LocalMockProvider();

export function getProvider(): Provider {
  return active;
}

/** Register a live provider (e.g. from an app that wires real credentials). */
export function setProvider(provider: Provider): void {
  active = provider;
}
