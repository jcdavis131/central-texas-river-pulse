import type { Card, Persona } from "./types";
import {
  CITIES,
  DEFAULT_ALIAS_DOMAIN,
  FIRST_NAMES,
  IDENTITY_COLORS,
  LAST_NAMES,
  STREETS,
  STREET_TYPES,
} from "./data";

/** Cryptographically strong integer in [0, max). */
export function randInt(max: number): number {
  if (max <= 0) return 0;
  // Rejection sampling to avoid modulo bias.
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)];
}

export function randomId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function generatePersona(): Persona {
  const loc = pick(CITIES);
  const year = 1965 + randInt(40); // ages ~20–60 relative to present-ish
  const month = 1 + randInt(12);
  const day = 1 + randInt(28);
  const zip = loc.zipPrefix + String(randInt(100)).padStart(2, "0");
  return {
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    dateOfBirth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    street: `${100 + randInt(9800)} ${pick(STREETS)} ${pick(STREET_TYPES)}`,
    city: loc.city,
    state: loc.state,
    zip,
  };
}

/** A per-service email alias, e.g. "netflix.a3f9@relay.veil.example". */
export function generateEmailAlias(label: string, domain = DEFAULT_ALIAS_DOMAIN): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "mask";
  const tag = randomId().slice(0, 4);
  return `${slug}.${tag}@${domain}`;
}

/** A masked phone number in a clearly non-routable test range (555-01xx). */
export function generatePhoneAlias(): string {
  const area = 200 + randInt(700); // valid-looking NANP area code
  const line = String(randInt(100)).padStart(2, "0");
  return `+1 (${area}) 555-01${line}`;
}

const PW_LOWER = "abcdefghijkmnpqrstuvwxyz";
const PW_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PW_DIGIT = "23456789";
const PW_SYMBOL = "!@#$%^&*-_=+?";

export interface PasswordOptions {
  length?: number;
  symbols?: boolean;
  digits?: boolean;
  upper?: boolean;
}

export function generatePassword(opts: PasswordOptions = {}): string {
  const length = Math.max(8, Math.min(128, opts.length ?? 20));
  const pools: string[] = [PW_LOWER];
  if (opts.upper !== false) pools.push(PW_UPPER);
  if (opts.digits !== false) pools.push(PW_DIGIT);
  if (opts.symbols !== false) pools.push(PW_SYMBOL);

  // Guarantee at least one char from each enabled pool, then fill the rest.
  const chars: string[] = pools.map((p) => p[randInt(p.length)]);
  const all = pools.join("");
  while (chars.length < length) chars.push(all[randInt(all.length)]);

  // Fisher–Yates shuffle so the guaranteed chars aren't front-loaded.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Rough password strength estimate in bits of entropy. */
export function passwordEntropyBits(pw: string): number {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 20;
  return pool === 0 ? 0 : Math.round(pw.length * Math.log2(pool));
}

/**
 * Generate a Luhn-valid test card number. These are NON-FUNCTIONAL tokens for
 * UI/testing only — they cannot be charged. Real virtual cards require a
 * regulated card-issuing provider (see providers/).
 */
export function generateTestCard(): Card {
  // 16 digits: prefix 4 (Visa test space), 14 random, 1 Luhn check digit.
  const digits: number[] = [4];
  for (let i = 0; i < 14; i++) digits.push(randInt(10));
  digits.push(luhnCheckDigit(digits));
  const number = digits.join("").replace(/(.{4})/g, "$1 ").trim();

  const now = new Date();
  const expYear = now.getFullYear() + 2 + randInt(3);
  const expMonth = 1 + randInt(12);
  const cvc = String(randInt(1000)).padStart(3, "0");
  return { number, expMonth, expYear, cvc };
}

function luhnCheckDigit(partial: number[]): number {
  // partial is the number without its check digit; compute the digit that
  // makes the whole sequence Luhn-valid.
  let sum = 0;
  // The check digit will be at an even position from the right (index 0),
  // so existing digits alternate starting with "double" from the right.
  const reversed = [...partial].reverse();
  for (let i = 0; i < reversed.length; i++) {
    let d = reversed[i];
    // positions 0,2,4... (from right, excluding check digit) get doubled
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "").split("").map(Number);
  if (digits.length === 0) return false;
  let sum = 0;
  const reversed = digits.reverse();
  for (let i = 0; i < reversed.length; i++) {
    let d = reversed[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function pickColor(seed: number): string {
  return IDENTITY_COLORS[seed % IDENTITY_COLORS.length];
}
