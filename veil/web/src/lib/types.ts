export type IdentityStatus = "active" | "paused" | "revoked";

/** A generated persona — fake but internally consistent PII for a signup. */
export interface Persona {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  street: string;
  city: string;
  state: string;
  zip: string;
}

/** Stored login credential for a service. Only ever exists decrypted in memory. */
export interface Secret {
  username: string;
  password: string;
  totpSecret?: string; // base32, optional
  notes?: string;
}

/** A masked payment card. Numbers are non-functional test tokens (Luhn-valid). */
export interface Card {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  /** Optional per-alias spend ceiling in USD, purely for display/policy. */
  monthlyLimit?: number;
}

/**
 * A single masked identity used with one service. Bundles the aliases that
 * shield the user's real email/phone/PII plus the credential for that service.
 */
export interface Identity {
  id: string;
  label: string; // e.g. "Netflix", "Reddit"
  createdAt: string; // ISO
  status: IdentityStatus;
  emailAlias: string;
  phoneAlias: string;
  persona: Persona;
  secret?: Secret;
  card?: Card;
  color: string;
  /** Website this identity is used on. */
  url?: string;
  /** Free-form notes. */
  notes?: string;
  /** User-defined tags for grouping/filtering. */
  tags?: string[];
  /** Pinned to the top of the dashboard. */
  favorite?: boolean;
}

export type ThemePref = "system" | "light" | "dark";

export type ActivityKind =
  | "identity_created"
  | "identity_paused"
  | "identity_resumed"
  | "identity_revoked"
  | "email_forwarded"
  | "call_screened"
  | "secret_updated"
  | "card_issued";

export interface ActivityEvent {
  id: string;
  at: string; // ISO
  kind: ActivityKind;
  identityId?: string;
  detail: string;
}

export interface Settings {
  forwardEmail: string; // the real inbox aliases forward to
  forwardPhone: string; // the real number calls/texts relay to
  autoLockMinutes?: number; // lock the vault after N idle minutes (0 = never)
}

/** The full decrypted vault. Everything here is sealed at rest. */
export interface VaultState {
  version: 1;
  settings: Settings;
  identities: Identity[];
  activity: ActivityEvent[];
}

export function emptyVault(): VaultState {
  return {
    version: 1,
    settings: { forwardEmail: "", forwardPhone: "", autoLockMinutes: 15 },
    identities: [],
    activity: [],
  };
}
