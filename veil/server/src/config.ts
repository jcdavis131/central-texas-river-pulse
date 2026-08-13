/** Runtime configuration, sourced from environment variables. */

function bool(v: string | undefined, dflt: boolean): boolean {
  if (v == null) return dflt;
  return /^(1|true|yes|on)$/i.test(v);
}

function num(v: string | undefined, dflt: number): number {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export interface EmailProviderConfig {
  enabled: boolean;
  /** Outbound SMTP relay used to forward received mail to the real inbox. */
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  /** From address used when forwarding (should be on your alias domain). */
  fromAddress: string;
}

export interface TwilioConfig {
  enabled: boolean;
  accountSid: string;
  authToken: string;
}

export interface StripeConfig {
  enabled: boolean;
  secretKey: string;
  cardholderId: string;
}

export interface Config {
  port: number;
  dbPath: string;
  /** CORS allow-list; the web dev server by default. */
  corsOrigins: string[];
  /** Domain that alias addresses live on, e.g. "relay.example.com". */
  aliasDomain: string;
  /** Inbound SMTP listener (the MX target for aliasDomain). */
  smtpInbound: { enabled: boolean; port: number; host: string };
  email: EmailProviderConfig;
  twilio: TwilioConfig;
  stripe: StripeConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: num(env.PORT, 8787),
    dbPath: env.VEIL_DB ?? "./data/veil.db",
    corsOrigins: (env.VEIL_CORS ?? "http://localhost:5180").split(",").map((s) => s.trim()),
    aliasDomain: env.VEIL_ALIAS_DOMAIN ?? "relay.veil.example",
    smtpInbound: {
      enabled: bool(env.VEIL_SMTP_INBOUND, false),
      port: num(env.VEIL_SMTP_PORT, 2525),
      host: env.VEIL_SMTP_HOST ?? "0.0.0.0",
    },
    email: {
      enabled: bool(env.VEIL_EMAIL_ENABLED, false),
      smtpHost: env.SMTP_HOST ?? "",
      smtpPort: num(env.SMTP_PORT, 587),
      smtpUser: env.SMTP_USER ?? "",
      smtpPass: env.SMTP_PASS ?? "",
      smtpSecure: bool(env.SMTP_SECURE, false),
      fromAddress: env.SMTP_FROM ?? `no-reply@${env.VEIL_ALIAS_DOMAIN ?? "relay.veil.example"}`,
    },
    twilio: {
      enabled: bool(env.VEIL_TWILIO_ENABLED, false),
      accountSid: env.TWILIO_ACCOUNT_SID ?? "",
      authToken: env.TWILIO_AUTH_TOKEN ?? "",
    },
    stripe: {
      enabled: bool(env.VEIL_STRIPE_ENABLED, false),
      secretKey: env.STRIPE_SECRET_KEY ?? "",
      cardholderId: env.STRIPE_CARDHOLDER_ID ?? "",
    },
  };
}

export type { Config as VeilConfig };
