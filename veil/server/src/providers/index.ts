import type { Config } from "../config.js";
import { SmtpForwarder } from "./email-smtp.js";
import { TwilioPhoneProvider } from "./phone-twilio.js";
import { StripeCardProvider } from "./card-stripe.js";
import type { Providers } from "./types.js";

export * from "./types.js";

/** Build the provider set from config. Each adapter is live iff configured. */
export function buildProviders(cfg: Config): Providers {
  return {
    email: new SmtpForwarder(cfg.email),
    phone: new TwilioPhoneProvider(cfg.twilio),
    card: new StripeCardProvider(cfg.stripe),
  };
}
