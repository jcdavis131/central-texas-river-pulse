import {
  deriveKey,
  makeVerifier,
  newKdfParams,
  open,
  seal,
  verify,
  type KdfParams,
  type Sealed,
} from "../crypto/vault";
import { emptyVault, type VaultState } from "./types";

const LS_KEY = "veil.vault.v1";

interface PersistedVault {
  kdf: KdfParams;
  verifier: Sealed;
  payload: Sealed | null; // encrypted VaultState JSON
}

function read(): PersistedVault | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedVault;
  } catch {
    return null;
  }
}

function write(v: PersistedVault): void {
  localStorage.setItem(LS_KEY, JSON.stringify(v));
}

export function isInitialized(): boolean {
  return read() !== null;
}

/** Create a brand-new vault protected by `password`. Returns the derived key. */
export async function initialize(password: string): Promise<CryptoKey> {
  const kdf = newKdfParams();
  const key = await deriveKey(password, kdf);
  const verifier = await makeVerifier(key);
  const payload = await seal(key, JSON.stringify(emptyVault()));
  write({ kdf, verifier, payload });
  return key;
}

export interface UnlockResult {
  key: CryptoKey;
  state: VaultState;
}

/** Returns null when the password is wrong. */
export async function unlock(password: string): Promise<UnlockResult | null> {
  const persisted = read();
  if (!persisted) return null;
  const key = await deriveKey(password, persisted.kdf);
  if (!(await verify(key, persisted.verifier))) return null;
  const state = persisted.payload
    ? (JSON.parse(await open(key, persisted.payload)) as VaultState)
    : emptyVault();
  return { key, state };
}

/** Encrypt and persist the given state. Never writes plaintext. */
export async function save(key: CryptoKey, state: VaultState): Promise<void> {
  const persisted = read();
  if (!persisted) throw new Error("vault not initialized");
  persisted.payload = await seal(key, JSON.stringify(state));
  write(persisted);
}

/** Export the encrypted blob for backup. Safe to store anywhere. */
export function exportEncrypted(): string | null {
  return localStorage.getItem(LS_KEY);
}

/** Restore from an encrypted backup blob. Does not verify the password here. */
export function importEncrypted(blob: string): boolean {
  try {
    const parsed = JSON.parse(blob) as PersistedVault;
    if (!parsed.kdf || !parsed.verifier) return false;
    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

/** Permanently destroy the local vault. Irreversible without a backup. */
export function destroy(): void {
  localStorage.removeItem(LS_KEY);
}

/** Change the master password by re-deriving a key and re-sealing everything. */
export async function changePassword(
  currentKey: CryptoKey,
  state: VaultState,
  newPassword: string,
): Promise<CryptoKey> {
  void currentKey;
  const kdf = newKdfParams();
  const key = await deriveKey(newPassword, kdf);
  const verifier = await makeVerifier(key);
  const payload = await seal(key, JSON.stringify(state));
  write({ kdf, verifier, payload });
  return key;
}
