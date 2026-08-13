import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, VeilApi, type HealthInfo } from "../lib/api";
import { exportEncrypted, importEncrypted } from "../lib/store";

const LS_CONN = "veil.server.conn.v1";

interface StoredConn {
  baseUrl: string;
  token: string;
  email: string;
}

function loadConn(): StoredConn | null {
  const raw = localStorage.getItem(LS_CONN);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredConn;
  } catch {
    return null;
  }
}

// The local encrypted blob is JSON (ASCII + base64); wrap for safe base64 transit.
function encodeBlob(blob: string): string {
  return btoa(unescape(encodeURIComponent(blob)));
}
function decodeBlob(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export interface ServerApi {
  connected: boolean;
  email: string | null;
  baseUrl: string | null;
  health: HealthInfo | null;
  error: string | null;
  busy: boolean;
  /** Raw client for feature calls (inbox, cards) — null when not connected. */
  client: VeilApi | null;

  connect(baseUrl: string, email: string, password: string, mode: "login" | "register"): Promise<boolean>;
  disconnect(): void;
  syncPush(): Promise<boolean>;
  syncPull(): Promise<"updated" | "nochange" | "empty">;
  checkBreach(password: string): Promise<{ breached: boolean; count: number }>;
  /** Register an email alias on the server so mail to it is forwarded. Returns the address. */
  provisionEmailAlias(label: string, destination: string): Promise<string | null>;
}

export function useServer(): ServerApi {
  const [conn, setConn] = useState<StoredConn | null>(() => loadConn());
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => {
    if (!conn) return null;
    return new VeilApi(conn.baseUrl, conn.token);
  }, [conn]);

  useEffect(() => {
    if (!api) return;
    api.health().then(setHealth).catch(() => setHealth(null));
  }, [api]);

  const connect = useCallback(
    async (baseUrl: string, email: string, password: string, mode: "login" | "register") => {
      setError(null);
      setBusy(true);
      try {
        const client = new VeilApi(baseUrl);
        const res = mode === "register" ? await client.register(email, password) : await client.login(email, password);
        const stored: StoredConn = { baseUrl: baseUrl.replace(/\/+$/, ""), token: res.token, email: res.user.email };
        localStorage.setItem(LS_CONN, JSON.stringify(stored));
        setConn(stored);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not reach the server.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (api) void api.logout().catch(() => undefined);
    localStorage.removeItem(LS_CONN);
    setConn(null);
    setHealth(null);
  }, [api]);

  const syncPush = useCallback(async () => {
    if (!api) return false;
    const blob = exportEncrypted();
    if (!blob) return false;
    setBusy(true);
    try {
      // Base the write on the server's current version to satisfy concurrency.
      const { vault } = await api.getVault();
      const next = (vault?.version ?? 0) + 1;
      await api.putVault({ version: next, ciphertext: encodeBlob(blob), iv: "blob" });
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sync push failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [api]);

  const syncPull = useCallback(async (): Promise<"updated" | "nochange" | "empty"> => {
    if (!api) return "empty";
    setBusy(true);
    try {
      const { vault } = await api.getVault();
      if (!vault) return "empty";
      const blob = decodeBlob(vault.ciphertext);
      const current = exportEncrypted();
      if (blob === current) return "nochange";
      importEncrypted(blob);
      return "updated";
    } finally {
      setBusy(false);
    }
  }, [api]);

  const checkBreach = useCallback(
    async (password: string) => {
      if (!api) throw new Error("not connected");
      return api.checkBreach(password);
    },
    [api],
  );

  const provisionEmailAlias = useCallback(
    async (label: string, destination: string) => {
      if (!api) return null;
      const { alias } = await api.createAlias({ kind: "email", label, destination });
      return alias.address;
    },
    [api],
  );

  return {
    connected: Boolean(conn),
    email: conn?.email ?? null,
    baseUrl: conn?.baseUrl ?? null,
    health,
    error,
    busy,
    client: api,
    connect,
    disconnect,
    syncPush,
    syncPull,
    checkBreach,
    provisionEmailAlias,
  };
}
