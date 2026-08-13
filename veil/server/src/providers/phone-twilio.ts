import type { TwilioConfig } from "../config.js";
import type { PhoneProvider } from "./types.js";

/**
 * Twilio-backed phone masking via the REST API (no SDK dependency — plain fetch).
 * Provisioning buys/reserves an incoming number; SMS relay sends an outbound
 * message to the user's real number. Live only when Twilio credentials are set.
 */
export class TwilioPhoneProvider implements PhoneProvider {
  readonly kind = "phone" as const;
  readonly live: boolean;
  private sid: string;
  private token: string;
  private base = "https://api.twilio.com/2010-04-01";

  constructor(cfg: TwilioConfig) {
    this.live = cfg.enabled && Boolean(cfg.accountSid && cfg.authToken);
    this.sid = cfg.accountSid;
    this.token = cfg.authToken;
  }

  private authHeader(): string {
    return "Basic " + Buffer.from(`${this.sid}:${this.token}`).toString("base64");
  }

  async provision(relayTo: string): Promise<{ number: string }> {
    if (!this.live) {
      // Dormant: return a clearly-fake reservation so the flow completes offline.
      return { number: `+1555010${Math.floor(1000 + Math.random() * 8999)}` };
    }
    // Search for an available US local number, then buy it.
    const searchUrl = `${this.base}/Accounts/${this.sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true&PageSize=1`;
    const search = await fetch(searchUrl, { headers: { Authorization: this.authHeader() } });
    if (!search.ok) throw new Error(`twilio search failed: ${search.status}`);
    const found = (await search.json()) as { available_phone_numbers?: Array<{ phone_number: string }> };
    const candidate = found.available_phone_numbers?.[0]?.phone_number;
    if (!candidate) throw new Error("no available numbers");

    const buyUrl = `${this.base}/Accounts/${this.sid}/IncomingPhoneNumbers.json`;
    const buy = await fetch(buyUrl, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ PhoneNumber: candidate, FriendlyName: `veil->${relayTo}` }),
    });
    if (!buy.ok) throw new Error(`twilio purchase failed: ${buy.status}`);
    const bought = (await buy.json()) as { phone_number: string };
    return { number: bought.phone_number };
  }

  async relaySms(from: string, to: string, body: string, relayTo: string): Promise<void> {
    if (!this.live) {
      console.log(`[phone] would relay SMS from ${from} (alias ${to}) to ${relayTo}: ${body}`);
      return;
    }
    const url = `${this.base}/Accounts/${this.sid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: relayTo,
        From: to, // the alias number
        Body: `From ${from}: ${body}`,
      }),
    });
    if (!res.ok) throw new Error(`twilio send failed: ${res.status}`);
  }
}
