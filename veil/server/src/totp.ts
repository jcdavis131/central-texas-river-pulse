import { createHmac } from "node:crypto";

/**
 * RFC 4226 (HOTP) / RFC 6238 (TOTP) implementation.
 *
 * Veil stores TOTP secrets inside the end-to-end-encrypted vault; this module
 * lets the client (or server, if desired) derive the current 6-digit code so
 * users don't need a separate authenticator app.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export type HotpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export interface TotpOptions {
  digits?: number;
  period?: number;
  algorithm?: HotpAlgorithm;
  /** Unix time in ms; defaults to now. */
  timestamp?: number;
}

export function hotp(secret: Buffer, counter: number, digits = 6, algorithm: HotpAlgorithm = "SHA1"): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(algorithm.toLowerCase(), secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

export function totp(secretBase32: string, opts: TotpOptions = {}): string {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const algorithm = opts.algorithm ?? "SHA1";
  const now = opts.timestamp ?? Date.now();
  const counter = Math.floor(now / 1000 / period);
  return hotp(base32Decode(secretBase32), counter, digits, algorithm);
}

/** Seconds remaining in the current TOTP window. */
export function totpRemaining(opts: TotpOptions = {}): number {
  const period = opts.period ?? 30;
  const now = opts.timestamp ?? Date.now();
  return period - (Math.floor(now / 1000) % period);
}

/** Verify a code allowing +/- `window` steps of clock drift. */
export function totpVerify(secretBase32: string, code: string, opts: TotpOptions & { window?: number } = {}): boolean {
  const period = opts.period ?? 30;
  const window = opts.window ?? 1;
  const now = opts.timestamp ?? Date.now();
  const secret = base32Decode(secretBase32);
  const digits = opts.digits ?? 6;
  const algorithm = opts.algorithm ?? "SHA1";
  const base = Math.floor(now / 1000 / period);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, base + i, digits, algorithm) === code) return true;
  }
  return false;
}

/** Build an otpauth:// URI for QR provisioning. */
export function otpauthURI(params: {
  secret: string;
  label: string;
  issuer?: string;
  digits?: number;
  period?: number;
  algorithm?: HotpAlgorithm;
}): string {
  const q = new URLSearchParams({ secret: params.secret });
  if (params.issuer) q.set("issuer", params.issuer);
  q.set("digits", String(params.digits ?? 6));
  q.set("period", String(params.period ?? 30));
  q.set("algorithm", params.algorithm ?? "SHA1");
  const label = params.issuer ? `${params.issuer}:${params.label}` : params.label;
  return `otpauth://totp/${encodeURIComponent(label)}?${q.toString()}`;
}
