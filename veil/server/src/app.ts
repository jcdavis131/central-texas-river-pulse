import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Config } from "./config.js";
import type { Db, UserRow, AliasStatus } from "./db.js";
import type { Providers } from "./providers/index.js";
import {
  hashPassword,
  isExpired,
  isValidEmail,
  newSessionToken,
  sessionExpiry,
  verifyPassword,
} from "./auth.js";
import { checkPassword } from "./breach.js";
import { totp, totpRemaining, totpVerify, otpauthURI, base32Encode } from "./totp.js";
import { emailAlias, generatePassword, nowIso, randomId } from "./util.js";
import { randomBytes } from "node:crypto";

type Vars = { user: UserRow };

export interface AppDeps {
  db: Db;
  providers: Providers;
  config: Config;
}

export function createApp({ db, providers, config }: AppDeps): Hono<{ Variables: Vars }> {
  const app = new Hono<{ Variables: Vars }>();

  app.use("/api/*", cors({ origin: config.corsOrigins, credentials: true }));

  const auth = async (c: any, next: any) => {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const session = db.getSession(token);
    if (!session || isExpired(session.expires_at)) {
      if (session) db.deleteSession(token);
      return c.json({ error: "unauthorized" }, 401);
    }
    const user = db.getUserById(session.user_id);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("user", user);
    await next();
  };

  const logActivity = (userId: string, kind: string, detail: string) =>
    db.addActivity({ id: randomId(), user_id: userId, at: nowIso(), kind, detail });

  // ---------- health ----------
  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      aliasDomain: config.aliasDomain,
      providers: {
        email: providers.email.live,
        phone: providers.phone.live,
        card: providers.card.live,
      },
    }),
  );

  // ---------- auth ----------
  app.post("/api/auth/register", async (c) => {
    const { email, password } = await c.req.json().catch(() => ({}));
    if (!isValidEmail(email) || typeof password !== "string" || password.length < 8) {
      return c.json({ error: "email and password (min 8 chars) required" }, 400);
    }
    if (db.getUserByEmail(email.toLowerCase())) {
      return c.json({ error: "account already exists" }, 409);
    }
    const { hash, salt } = await hashPassword(password);
    const user: UserRow = {
      id: randomId(),
      email: email.toLowerCase(),
      pw_hash: hash,
      pw_salt: salt,
      created_at: nowIso(),
    };
    db.createUser(user);
    const token = newSessionToken();
    db.createSession({ token, user_id: user.id, created_at: nowIso(), expires_at: sessionExpiry() });
    return c.json({ token, user: { id: user.id, email: user.email } }, 201);
  });

  app.post("/api/auth/login", async (c) => {
    const { email, password } = await c.req.json().catch(() => ({}));
    if (typeof email !== "string" || typeof password !== "string") {
      return c.json({ error: "email and password required" }, 400);
    }
    const user = db.getUserByEmail(email.toLowerCase());
    if (!user || !(await verifyPassword(password, user.pw_hash, user.pw_salt))) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    const token = newSessionToken();
    db.createSession({ token, user_id: user.id, created_at: nowIso(), expires_at: sessionExpiry() });
    return c.json({ token, user: { id: user.id, email: user.email } });
  });

  app.post("/api/auth/logout", auth, (c) => {
    const header = c.req.header("Authorization") ?? "";
    db.deleteSession(header.slice(7));
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", auth, (c) => {
    const user = c.get("user");
    return c.json({ user: { id: user.id, email: user.email } });
  });

  // ---------- encrypted vault sync (server never sees plaintext) ----------
  app.get("/api/vault", auth, (c) => {
    const row = db.getVault(c.get("user").id);
    if (!row) return c.json({ vault: null });
    return c.json({
      vault: { version: row.version, ciphertext: row.ciphertext, iv: row.iv, updatedAt: row.updated_at },
    });
  });

  app.put("/api/vault", auth, async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const { version, ciphertext, iv } = body ?? {};
    if (typeof ciphertext !== "string" || typeof iv !== "string" || typeof version !== "number") {
      return c.json({ error: "version, ciphertext, iv required" }, 400);
    }
    const existing = db.getVault(user.id);
    // Optimistic concurrency: the client must base its write on the current version.
    if (existing && version !== existing.version + 1) {
      return c.json({ error: "version conflict", currentVersion: existing.version }, 409);
    }
    db.upsertVault({
      user_id: user.id,
      version,
      ciphertext,
      iv,
      updated_at: nowIso(),
    });
    return c.json({ ok: true, version });
  });

  // ---------- aliases ----------
  app.get("/api/aliases", auth, (c) => c.json({ aliases: db.listAliases(c.get("user").id) }));

  app.post("/api/aliases", auth, async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const kind = body.kind as "email" | "phone" | "card";
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "mask";
    const destination = typeof body.destination === "string" ? body.destination : "";

    let address = "";
    let extra: Record<string, unknown> = {};
    try {
      if (kind === "email") {
        address = emailAlias(label, config.aliasDomain);
      } else if (kind === "phone") {
        const { number } = await providers.phone.provision(destination);
        address = number;
      } else if (kind === "card") {
        const card = await providers.card.issue({ label, monthlyLimit: body.monthlyLimit });
        address = `card:${card.id}`;
        extra = { card };
      } else {
        return c.json({ error: "kind must be email|phone|card" }, 400);
      }
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "provisioning failed" }, 502);
    }

    const row = {
      id: randomId(),
      user_id: user.id,
      address: address.toLowerCase(),
      destination,
      kind,
      label,
      status: "active" as AliasStatus,
      created_at: nowIso(),
    };
    db.createAlias(row);
    logActivity(user.id, `${kind}_alias_created`, `Created ${kind} alias for “${label}”`);
    return c.json({ alias: row, ...extra }, 201);
  });

  app.post("/api/aliases/:id/status", auth, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const { status } = await c.req.json().catch(() => ({}));
    if (!["active", "paused", "revoked"].includes(status)) {
      return c.json({ error: "invalid status" }, 400);
    }
    db.setAliasStatus(id, user.id, status);
    logActivity(user.id, `alias_${status}`, `Set alias ${id} to ${status}`);
    return c.json({ ok: true });
  });

  app.delete("/api/aliases/:id", auth, (c) => {
    const user = c.get("user");
    db.deleteAlias(c.req.param("id"), user.id);
    logActivity(user.id, "alias_deleted", `Deleted alias ${c.req.param("id")}`);
    return c.json({ ok: true });
  });

  // ---------- activity ----------
  app.get("/api/activity", auth, (c) => c.json({ activity: db.listActivity(c.get("user").id) }));

  // ---------- tools ----------
  app.post("/api/tools/breach", auth, async (c) => {
    const { password } = await c.req.json().catch(() => ({}));
    if (typeof password !== "string" || !password) return c.json({ error: "password required" }, 400);
    try {
      const result = await checkPassword(password);
      return c.json(result);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "breach check failed" }, 502);
    }
  });

  app.post("/api/tools/totp", auth, async (c) => {
    const { secret } = await c.req.json().catch(() => ({}));
    if (typeof secret !== "string" || !secret) return c.json({ error: "secret required" }, 400);
    try {
      return c.json({ code: totp(secret), remaining: totpRemaining() });
    } catch {
      return c.json({ error: "invalid TOTP secret" }, 400);
    }
  });

  app.post("/api/tools/totp/verify", auth, async (c) => {
    const { secret, code } = await c.req.json().catch(() => ({}));
    if (typeof secret !== "string" || typeof code !== "string") {
      return c.json({ error: "secret and code required" }, 400);
    }
    return c.json({ valid: totpVerify(secret, code) });
  });

  app.get("/api/tools/totp/new", auth, (c) => {
    const secret = base32Encode(randomBytes(20));
    const label = c.req.query("label") ?? "Veil";
    return c.json({ secret, uri: otpauthURI({ secret, label, issuer: "Veil" }) });
  });

  app.get("/api/tools/password", auth, (c) => {
    const len = Number(c.req.query("length")) || 20;
    return c.json({ password: generatePassword(len) });
  });

  return app;
}
