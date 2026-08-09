import {
  deriveKey,
  exportVek,
  importVek,
  makeVerifier,
  newKdfParams,
  newRecoveryKey,
  newVek,
  normalizeRecoveryKey,
  open,
  seal,
  unwrapVek,
  verify,
  wrapVek,
  type KdfParams,
  type Sealed,
} from "../crypto/vault";
import { emptyVault, type VaultState } from "./types";

const LS_KEY = "veil.vault.v1";

/** Envelope-encrypted vault (spec §4.1/§4.4). VEK wrapped by two KEKs. */
interface PersistedVault {
  v: 2;
  kdfPw: KdfParams; // KDF for the password-derived KEK
  kdfRec: KdfParams; // KDF for the recovery-key-derived KEK
  wrapPw: Sealed; // VEK wrapped by the password KEK
  wrapRec: Sealed; // VEK wrapped by the recovery-key KEK
  verifier: Sealed; // sealed by the VEK — sanity check after unwrap
  payload: Sealed | null; // vault JSON sealed by the VEK
}

/** Legacy v1 layout: AES key derived directly from the password (no VEK). */
interface LegacyVault {
  kdf: KdfParams;
  verifier: Sealed;
  payload: Sealed | null;
}

function readRaw(): PersistedVault | LegacyVault | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedVault | LegacyVault;
  } catch {
    return null;
  }
}

function isV2(v: PersistedVault | LegacyVault): v is PersistedVault {
  return (v as PersistedVault).v === 2;
}

function write(v: PersistedVault): void {
  localStorage.setItem(LS_KEY, JSON.stringify(v));
}

export function isInitialized(): boolean {
  return readRaw() !== null;
}

export interface InitResult {
  key: CryptoKey;
  /** Shown to the user exactly once — the only escrow path if the password is lost. */
  recoveryKey: string;
}

/** Build a fresh v2 envelope around an existing VEK + state, protected by `password`. */
async function sealEnvelope(
  vek: Uint8Array<ArrayBuffer>,
  password: string,
  recoveryKey: string,
  state: VaultState,
): Promise<PersistedVault> {
  const kdfPw = newKdfParams();
  const kdfRec = newKdfParams();
  const kekPw = await deriveKey(password, kdfPw);
  const kekRec = await deriveKey(normalizeRecoveryKey(recoveryKey), kdfRec);
  const vekKey = await importVek(vek);
  return {
    v: 2,
    kdfPw,
    kdfRec,
    wrapPw: await wrapVek(kekPw, vek),
    wrapRec: await wrapVek(kekRec, vek),
    verifier: await makeVerifier(vekKey),
    payload: await seal(vekKey, JSON.stringify(state)),
  };
}

/** Create a brand-new vault. Returns the VEK CryptoKey and the one-time recovery key. */
export async function initialize(password: string): Promise<InitResult> {
  const vek = newVek();
  const recoveryKey = newRecoveryKey();
  write(await sealEnvelope(vek, password, recoveryKey, emptyVault()));
  return { key: await importVek(vek), recoveryKey };
}

export interface UnlockResult {
  key: CryptoKey;
  state: VaultState;
  /** Set only when a legacy v1 vault was transparently upgraded on unlock. */
  migratedRecoveryKey?: string;
}

/** Returns null when the password is wrong. */
export async function unlock(password: string): Promise<UnlockResult | null> {
  const persisted = readRaw();
  if (!persisted) return null;

  if (!isV2(persisted)) {
    // Legacy v1: derive the AES key directly, verify, then upgrade to v2.
    const legacyKey = await deriveKey(password, persisted.kdf);
    if (!(await verify(legacyKey, persisted.verifier))) return null;
    const state = persisted.payload
      ? (JSON.parse(await open(legacyKey, persisted.payload)) as VaultState)
      : emptyVault();
    const vek = newVek();
    const recoveryKey = newRecoveryKey();
    write(await sealEnvelope(vek, password, recoveryKey, state));
    return { key: await importVek(vek), state, migratedRecoveryKey: recoveryKey };
  }

  let vek: Uint8Array<ArrayBuffer>;
  try {
    const kekPw = await deriveKey(password, persisted.kdfPw);
    vek = await unwrapVek(kekPw, persisted.wrapPw);
  } catch {
    return null; // wrong password — GCM auth failure
  }
  const vekKey = await importVek(vek);
  const state = persisted.payload
    ? (JSON.parse(await open(vekKey, persisted.payload)) as VaultState)
    : emptyVault();
  return { key: vekKey, state };
}

/**
 * Recover access using the recovery key, setting a new master password.
 * Returns null if the recovery key is invalid. The recovery key itself is
 * unchanged and remains valid afterward.
 */
export async function recover(
  recoveryKey: string,
  newPassword: string,
): Promise<UnlockResult | null> {
  const persisted = readRaw();
  if (!persisted || !isV2(persisted)) return null;

  let vek: Uint8Array<ArrayBuffer>;
  try {
    const kekRec = await deriveKey(normalizeRecoveryKey(recoveryKey), persisted.kdfRec);
    vek = await unwrapVek(kekRec, persisted.wrapRec);
  } catch {
    return null; // invalid recovery key
  }

  // Re-wrap the VEK under the new password; keep the same recovery wrap + data.
  const kdfPw = newKdfParams();
  const kekPw = await deriveKey(newPassword, kdfPw);
  persisted.kdfPw = kdfPw;
  persisted.wrapPw = await wrapVek(kekPw, vek);
  write(persisted);

  const vekKey = await importVek(vek);
  const state = persisted.payload
    ? (JSON.parse(await open(vekKey, persisted.payload)) as VaultState)
    : emptyVault();
  return { key: vekKey, state };
}

/** Encrypt and persist the given state. Never writes plaintext. */
export async function save(key: CryptoKey, state: VaultState): Promise<void> {
  const persisted = readRaw();
  if (!persisted || !isV2(persisted)) throw new Error("vault not initialized");
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
    const parsed = JSON.parse(blob) as PersistedVault | LegacyVault;
    const ok = isV2(parsed) ? Boolean(parsed.wrapPw && parsed.wrapRec) : Boolean(parsed.kdf && parsed.verifier);
    if (!ok) return false;
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

/**
 * Change the master password by re-wrapping the VEK — no need to re-encrypt
 * the vault contents. Returns the same VEK key (unchanged). The recovery key
 * continues to work.
 */
export async function changePassword(
  currentKey: CryptoKey,
  _state: VaultState,
  newPassword: string,
): Promise<CryptoKey> {
  const persisted = readRaw();
  if (!persisted || !isV2(persisted)) throw new Error("vault not initialized");
  const vek = await exportVek(currentKey);
  const kdfPw = newKdfParams();
  const kekPw = await deriveKey(newPassword, kdfPw);
  persisted.kdfPw = kdfPw;
  persisted.wrapPw = await wrapVek(kekPw, vek);
  write(persisted);
  return currentKey;
}
