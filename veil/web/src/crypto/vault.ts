/**
 * Zero-knowledge vault cryptography (envelope model — spec §4.1, §4.4).
 *
 * The master password never leaves the device and is never stored. A random
 * 256-bit Vault Encryption Key (VEK) encrypts all vault data with AES-256-GCM.
 * The VEK itself is wrapped (encrypted) by two independently derived key-
 * encryption keys (KEKs): one from the master password, one from a high-entropy
 * recovery key. Only ciphertext, KDF salts, and KDF parameters are persisted —
 * an attacker with the full stored blob learns nothing without the master
 * password or the recovery key.
 */

const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 32; // 256-bit salt (spec §4.1 step 1)
const IV_BYTES = 12;
const VEK_BYTES = 32; // 256-bit vault encryption key

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface KdfParams {
  /** base64url-encoded random salt */
  salt: string;
  iterations: number;
}

/** A sealed ciphertext envelope safe to persist to disk/localStorage. */
export interface Sealed {
  /** base64url-encoded random IV */
  iv: string;
  /** base64url-encoded AES-GCM ciphertext (includes auth tag) */
  data: string;
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const binary = atob(norm + pad);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(b);
  return b;
}

/** UTF-8 encode into a guaranteed ArrayBuffer-backed view (satisfies BufferSource). */
function utf8(s: string): Uint8Array<ArrayBuffer> {
  const encoded = enc.encode(s);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

export function newKdfParams(): KdfParams {
  return { salt: toB64(randomBytes(SALT_BYTES)), iterations: PBKDF2_ITERATIONS };
}

/**
 * Derive a non-extractable AES-GCM key-encryption key from a secret
 * (master password or recovery key). Used to wrap/unwrap the VEK.
 */
export async function deriveKey(secret: string, params: KdfParams): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromB64(params.salt),
      iterations: params.iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, plaintext: string): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    utf8(plaintext),
  );
  return { iv: toB64(iv), data: toB64(ct) };
}

/** Throws if the key is wrong or the ciphertext was tampered with. */
export async function open(key: CryptoKey, sealed: Sealed): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(sealed.iv) },
    key,
    fromB64(sealed.data),
  );
  return dec.decode(pt);
}

/**
 * Verify a candidate key against a stored verifier. Used to sanity-check the
 * unwrapped VEK without ever comparing key material directly.
 */
export async function verify(key: CryptoKey, verifier: Sealed): Promise<boolean> {
  try {
    return (await open(key, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

const VERIFIER_PLAINTEXT = "veil-verifier-v1";

export async function makeVerifier(key: CryptoKey): Promise<Sealed> {
  return seal(key, VERIFIER_PLAINTEXT);
}

// ---------------------------------------------------------------------------
// Envelope encryption: VEK + key wrapping (spec §4.1 steps 3-4)
// ---------------------------------------------------------------------------

/** Fresh random 256-bit Vault Encryption Key (raw bytes, kept only in memory). */
export function newVek(): Uint8Array<ArrayBuffer> {
  return randomBytes(VEK_BYTES);
}

/**
 * Import raw VEK bytes as an AES-GCM CryptoKey. Extractable so the master
 * password can be changed (re-wrap) without re-encrypting every record; the
 * raw key exists only in RAM and is never persisted in the clear.
 */
export async function importVek(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

/** Wrap (encrypt) the VEK under a KEK so it can be stored at rest. */
export async function wrapVek(kek: CryptoKey, vek: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  return seal(kek, toB64(vek));
}

/** Unwrap the VEK with a KEK. Throws if the KEK is wrong (GCM auth failure). */
export async function unwrapVek(kek: CryptoKey, wrapped: Sealed): Promise<Uint8Array<ArrayBuffer>> {
  return fromB64(await open(kek, wrapped));
}

/** Export the raw bytes of an (extractable) VEK for re-wrapping. */
export async function exportVek(vekKey: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const raw = await crypto.subtle.exportKey("raw", vekKey);
  return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
}

// ---------------------------------------------------------------------------
// Recovery key (spec §4.4): high-entropy escrow secret shown once at creation.
// ---------------------------------------------------------------------------

// RFC 4648 base32 alphabet, minus padding. 256 bits -> 52 chars, grouped by 4.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Generate a 256-bit recovery key formatted as dash-grouped base32. */
export function newRecoveryKey(): string {
  const raw = base32Encode(randomBytes(VEK_BYTES));
  return (raw.match(/.{1,4}/g) ?? []).join("-");
}

/** Normalize user-entered recovery key (strip spaces/dashes, uppercase). */
export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}
