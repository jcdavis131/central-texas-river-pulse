/**
 * Zero-knowledge vault cryptography.
 *
 * The master password never leaves the device and is never stored. A symmetric
 * key is derived from it with PBKDF2 and used for AES-GCM. Only ciphertext,
 * the KDF salt, and KDF parameters are persisted — an attacker with full access
 * to the stored blob learns nothing without the master password.
 */

const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

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

/** Derive a non-extractable AES-GCM key from a master password. */
export async function deriveKey(password: string, params: KdfParams): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    utf8(password),
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
 * Verify a candidate key against a stored verifier. Used to check the master
 * password on unlock without ever comparing password material directly.
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
