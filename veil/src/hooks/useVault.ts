import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as store from "../lib/store";
import {
  emptyVault,
  type ActivityEvent,
  type ActivityKind,
  type Identity,
  type Settings,
  type VaultState,
} from "../lib/types";
import { randomId } from "../lib/generators";

export type LockState = "loading" | "uninitialized" | "locked" | "unlocked";

export interface VaultApi {
  lockState: LockState;
  state: VaultState;
  error: string | null;

  initialize(password: string): Promise<void>;
  unlock(password: string): Promise<boolean>;
  lock(): void;

  addIdentity(identity: Identity): Promise<void>;
  updateIdentity(id: string, patch: Partial<Identity>): Promise<void>;
  setIdentityStatus(id: string, status: Identity["status"]): Promise<void>;
  removeIdentity(id: string): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<void>;
  log(kind: ActivityKind, detail: string, identityId?: string): Promise<void>;

  changePassword(newPassword: string): Promise<void>;
  destroy(): void;
}

export function useVault(): VaultApi {
  const [lockState, setLockState] = useState<LockState>("loading");
  const [state, setState] = useState<VaultState>(emptyVault());
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    setLockState(store.isInitialized() ? "locked" : "uninitialized");
  }, []);

  const persist = useCallback(async (next: VaultState) => {
    if (!keyRef.current) throw new Error("vault is locked");
    setState(next);
    await store.save(keyRef.current, next);
  }, []);

  const initialize = useCallback(async (password: string) => {
    setError(null);
    keyRef.current = await store.initialize(password);
    setState(emptyVault());
    setLockState("unlocked");
  }, []);

  const unlock = useCallback(async (password: string) => {
    setError(null);
    const res = await store.unlock(password);
    if (!res) {
      setError("Incorrect master password.");
      return false;
    }
    keyRef.current = res.key;
    setState(res.state);
    setLockState("unlocked");
    return true;
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setState(emptyVault());
    setLockState("locked");
  }, []);

  const log = useCallback(
    async (kind: ActivityKind, detail: string, identityId?: string) => {
      const event: ActivityEvent = {
        id: randomId(),
        at: new Date().toISOString(),
        kind,
        detail,
        identityId,
      };
      // read latest via functional update to avoid stale closures
      setState((prev) => {
        const next = { ...prev, activity: [event, ...prev.activity].slice(0, 500) };
        if (keyRef.current) void store.save(keyRef.current, next);
        return next;
      });
    },
    [],
  );

  const addIdentity = useCallback(
    async (identity: Identity) => {
      await persist({ ...state, identities: [identity, ...state.identities] });
    },
    [persist, state],
  );

  const updateIdentity = useCallback(
    async (id: string, patch: Partial<Identity>) => {
      await persist({
        ...state,
        identities: state.identities.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      });
    },
    [persist, state],
  );

  const setIdentityStatus = useCallback(
    async (id: string, status: Identity["status"]) => {
      await updateIdentity(id, { status });
    },
    [updateIdentity],
  );

  const removeIdentity = useCallback(
    async (id: string) => {
      await persist({ ...state, identities: state.identities.filter((i) => i.id !== id) });
    },
    [persist, state],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await persist({ ...state, settings: { ...state.settings, ...patch } });
    },
    [persist, state],
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      if (!keyRef.current) throw new Error("vault is locked");
      keyRef.current = await store.changePassword(keyRef.current, state, newPassword);
    },
    [state],
  );

  const destroy = useCallback(() => {
    store.destroy();
    keyRef.current = null;
    setState(emptyVault());
    setLockState("uninitialized");
  }, []);

  return useMemo(
    () => ({
      lockState,
      state,
      error,
      initialize,
      unlock,
      lock,
      addIdentity,
      updateIdentity,
      setIdentityStatus,
      removeIdentity,
      updateSettings,
      log,
      changePassword,
      destroy,
    }),
    [
      lockState, state, error, initialize, unlock, lock, addIdentity, updateIdentity,
      setIdentityStatus, removeIdentity, updateSettings, log, changePassword, destroy,
    ],
  );
}
