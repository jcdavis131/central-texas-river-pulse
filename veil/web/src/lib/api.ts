/** Typed client for the Veil server API. */

export interface HealthInfo {
  ok: boolean;
  aliasDomain: string;
  providers: { email: boolean; phone: boolean; card: boolean };
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

export interface RemoteVault {
  version: number;
  ciphertext: string;
  iv: string;
  updatedAt: string;
}

export interface ServerAlias {
  id: string;
  address: string;
  destination: string;
  kind: "email" | "phone" | "card";
  label: string;
  status: "active" | "paused" | "revoked";
  created_at: string;
}

export interface BreachResult {
  breached: boolean;
  count: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class VeilApi {
  constructor(
    public baseUrl: string,
    private token: string | null = null,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const res = await fetch(this.baseUrl + path, { ...init, headers });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
    return body as T;
  }

  health() {
    return this.req<HealthInfo>("/api/health");
  }

  register(email: string, password: string) {
    return this.req<AuthResult>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  login(email: string, password: string) {
    return this.req<AuthResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  logout() {
    return this.req<{ ok: true }>("/api/auth/logout", { method: "POST" });
  }

  getVault() {
    return this.req<{ vault: RemoteVault | null }>("/api/vault");
  }

  putVault(v: { version: number; ciphertext: string; iv: string }) {
    return this.req<{ ok: true; version: number }>("/api/vault", {
      method: "PUT",
      body: JSON.stringify(v),
    });
  }

  listAliases() {
    return this.req<{ aliases: ServerAlias[] }>("/api/aliases");
  }

  createAlias(input: {
    kind: "email" | "phone" | "card";
    label: string;
    destination?: string;
    monthlyLimit?: number;
  }) {
    return this.req<{ alias: ServerAlias; card?: unknown }>("/api/aliases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  setAliasStatus(id: string, status: "active" | "paused" | "revoked") {
    return this.req<{ ok: true }>(`/api/aliases/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  checkBreach(password: string) {
    return this.req<BreachResult>("/api/tools/breach", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }
}
