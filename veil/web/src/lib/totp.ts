/**
 * Client-side TOTP (RFC 6238) using WebCrypto HMAC-SHA1, so authenticator codes
 * can be shown offline without sending the secret anywhere.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function randomBase32Secret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

async function hmacSha1(key: Uint8Array<ArrayBuffer>, msg: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return new Uint8Array(sig);
}

export async function totp(
  secretBase32: string,
  opts: { digits?: number; period?: number; timestamp?: number } = {},
): Promise<string> {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const now = opts.timestamp ?? Date.now();
  const counter = Math.floor(now / 1000 / period);

  const msg = new Uint8Array(new ArrayBuffer(8));
  const view = new DataView(msg.buffer);
  view.setBigUint64(0, BigInt(counter), false);

  const key = base32Decode(secretBase32);
  const hmac = await hmacSha1(key, msg);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function totpRemaining(period = 30, now = Date.now()): number {
  return period - (Math.floor(now / 1000) % period);
}
