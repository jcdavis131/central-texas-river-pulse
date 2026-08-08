import type { StripeConfig } from "../config.js";
import type { CardProvider, IssuedCard } from "./types.js";
import { generateTestCard } from "../testcard.js";

/**
 * Stripe Issuing-backed virtual cards via the REST API (plain fetch, no SDK).
 * Live only when a Stripe secret key + cardholder id are configured. When
 * dormant it returns a Luhn-valid NON-FUNCTIONAL test token so the flow works
 * offline; those tokens cannot be charged.
 */
export class StripeCardProvider implements CardProvider {
  readonly kind = "card" as const;
  readonly live: boolean;
  private key: string;
  private cardholder: string;
  private base = "https://api.stripe.com/v1";

  constructor(cfg: StripeConfig) {
    this.live = cfg.enabled && Boolean(cfg.secretKey && cfg.cardholderId);
    this.key = cfg.secretKey;
    this.cardholder = cfg.cardholderId;
  }

  async issue(opts: { monthlyLimit?: number; label?: string }): Promise<IssuedCard> {
    if (!this.live) {
      const t = generateTestCard();
      const digits = t.number.replace(/\s/g, "");
      return {
        id: "test_" + digits.slice(-8),
        last4: digits.slice(-4),
        expMonth: t.expMonth,
        expYear: t.expYear,
        brand: "visa-test",
        number: t.number,
        cvc: t.cvc,
      };
    }
    const form = new URLSearchParams({
      cardholder: this.cardholder,
      currency: "usd",
      type: "virtual",
    });
    if (opts.monthlyLimit != null) {
      form.set("spending_controls[spending_limits][0][amount]", String(opts.monthlyLimit * 100));
      form.set("spending_controls[spending_limits][0][interval]", "monthly");
    }
    const res = await fetch(`${this.base}/issuing/cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    if (!res.ok) throw new Error(`stripe issue failed: ${res.status}`);
    const card = (await res.json()) as {
      id: string;
      last4: string;
      exp_month: number;
      exp_year: number;
      brand: string;
    };
    return {
      id: card.id,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      brand: card.brand,
    };
  }

  async freeze(cardId: string): Promise<void> {
    if (!this.live) {
      console.log(`[card] would freeze ${cardId}`);
      return;
    }
    const res = await fetch(`${this.base}/issuing/cards/${cardId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ status: "inactive" }),
    });
    if (!res.ok) throw new Error(`stripe freeze failed: ${res.status}`);
  }
}
