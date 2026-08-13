import { describe, expect, it, beforeEach } from "vitest";
import { Hono } from "hono";
import { createApp } from "./app.js";
import { Db } from "./db.js";
import { buildProviders } from "./providers/index.js";
import { loadConfig } from "./config.js";
import { totp } from "./totp.js";

function makeApp(): Hono<any> {
  const config = loadConfig({ VEIL_ALIAS_DOMAIN: "relay.test", PORT: "0" } as NodeJS.ProcessEnv);
  const db = new Db(":memory:");
  const providers = buildProviders(config);
  return createApp({ db, providers, config });
}

const json = (body: unknown, token?: string) => ({
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

describe("HTTP API", () => {
  let app: Hono<any>;
  beforeEach(() => {
    app = makeApp();
  });

  async function register(email = "user@example.com", password = "supersecret") {
    const res = await app.request("/api/auth/register", json({ email, password }));
    return { res, body: (await res.json()) as { token: string; user: { id: string; email: string } } };
  }

  it("reports health with provider status", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.aliasDomain).toBe("relay.test");
    expect(body.providers).toHaveProperty("email");
  });

  it("registers, authenticates, and rejects after logout", async () => {
    const { res, body } = await register();
    expect(res.status).toBe(201);
    expect(body.token).toBeTruthy();

    const me = await app.request("/api/auth/me", { headers: { authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).user.email).toBe("user@example.com");

    await app.request("/api/auth/logout", json({}, body.token));
    const after = await app.request("/api/auth/me", {
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(after.status).toBe(401);
  });

  it("rejects duplicate registration and bad login", async () => {
    await register();
    const dup = await app.request("/api/auth/register", json({ email: "user@example.com", password: "supersecret" }));
    expect(dup.status).toBe(409);
    const bad = await app.request("/api/auth/login", json({ email: "user@example.com", password: "wrong" }));
    expect(bad.status).toBe(401);
  });

  it("stores and returns the encrypted vault with optimistic concurrency", async () => {
    const { body } = await register();
    const t = body.token;

    const put1 = await app.request("/api/vault", { ...json({ version: 1, ciphertext: "aGVsbG8", iv: "abc" }, t), method: "PUT" });
    expect(put1.status).toBe(200);

    const get = await app.request("/api/vault", { headers: { authorization: `Bearer ${t}` } });
    expect(((await get.json()) as any).vault.ciphertext).toBe("aGVsbG8");

    // Wrong next version -> 409 conflict
    const bad = await app.request("/api/vault", { ...json({ version: 5, ciphertext: "x", iv: "y" }, t), method: "PUT" });
    expect(bad.status).toBe(409);

    // Correct next version -> ok
    const ok = await app.request("/api/vault", { ...json({ version: 2, ciphertext: "d29ybGQ", iv: "def" }, t), method: "PUT" });
    expect(ok.status).toBe(200);
  });

  it("creates and lists an email alias on the configured domain", async () => {
    const { body } = await register();
    const t = body.token;
    const create = await app.request("/api/aliases", json({ kind: "email", label: "Reddit", destination: "me@real.com" }, t));
    expect(create.status).toBe(201);
    const alias = ((await create.json()) as any).alias;
    expect(alias.address).toMatch(/@relay\.test$/);
    expect(alias.address.startsWith("reddit.")).toBe(true);

    const list = await app.request("/api/aliases", { headers: { authorization: `Bearer ${t}` } });
    expect(((await list.json()) as any).aliases).toHaveLength(1);
  });

  it("issues a masked card via the dormant provider (Luhn test token)", async () => {
    const { body } = await register();
    const create = await app.request("/api/aliases", json({ kind: "card", label: "Streaming" }, body.token));
    expect(create.status).toBe(201);
    const out = (await create.json()) as any;
    expect(out.card.brand).toBe("visa-test");
    expect(out.card.number).toBeTruthy();
  });

  it("generates a TOTP secret and derives a matching code", async () => {
    const { body } = await register();
    const t = body.token;
    const gen = await app.request("/api/tools/totp/new?label=Test", { headers: { authorization: `Bearer ${t}` } });
    const { secret } = (await gen.json()) as { secret: string };
    expect(secret).toBeTruthy();

    const codeRes = await app.request("/api/tools/totp", json({ secret }, t));
    const { code } = (await codeRes.json()) as { code: string };
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toBe(totp(secret));

    const verify = await app.request("/api/tools/totp/verify", json({ secret, code }, t));
    expect(((await verify.json()) as any).valid).toBe(true);
  });

  it("guards protected routes without a token", async () => {
    const res = await app.request("/api/vault");
    expect(res.status).toBe(401);
  });
});

describe("inbox & cards", () => {
  function makeAppWithDb() {
    const config = loadConfig({ VEIL_ALIAS_DOMAIN: "relay.test", PORT: "0" } as NodeJS.ProcessEnv);
    const db = new Db(":memory:");
    const providers = buildProviders(config);
    return { app: createApp({ db, providers, config }), db };
  }

  async function registerOn(app: Hono<any>) {
    const res = await app.request("/api/auth/register", json({ email: "u@example.com", password: "supersecret" }));
    return ((await res.json()) as any).token as string;
  }

  it("lists forwarded messages and marks them read", async () => {
    const { app, db } = makeAppWithDb();
    const token = await registerOn(app);
    const me = (await (await app.request("/api/auth/me", { headers: { authorization: `Bearer ${token}` } })).json()) as any;

    db.addMessage({
      id: "m1",
      user_id: me.user.id,
      alias_address: "shop.ab12@relay.test",
      from_addr: "store@shop.com",
      subject: "Receipt #9",
      body: "thanks for your order",
      received_at: new Date().toISOString(),
      read: 0,
    });

    const list = (await (await app.request("/api/inbox", { headers: { authorization: `Bearer ${token}` } })).json()) as any;
    expect(list.messages).toHaveLength(1);
    expect(list.unread).toBe(1);
    expect(list.messages[0].subject).toBe("Receipt #9");

    await app.request("/api/inbox/m1/read", json({ read: true }, token));
    const after = (await (await app.request("/api/inbox", { headers: { authorization: `Bearer ${token}` } })).json()) as any;
    expect(after.unread).toBe(0);
  });

  it("refuses to reply when the email provider is dormant", async () => {
    const { app, db } = makeAppWithDb();
    const token = await registerOn(app);
    const me = (await (await app.request("/api/auth/me", { headers: { authorization: `Bearer ${token}` } })).json()) as any;
    db.addMessage({
      id: "m2", user_id: me.user.id, alias_address: "a@relay.test", from_addr: "x@y.com",
      subject: "hi", body: "hello", received_at: new Date().toISOString(), read: 0,
    });
    const res = await app.request("/api/inbox/m2/reply", json({ body: "hey back" }, token));
    expect(res.status).toBe(501);
  });

  it("issues, lists, and freezes a masked card (dormant test token)", async () => {
    const { app } = makeAppWithDb();
    const token = await registerOn(app);

    const create = await app.request("/api/cards", json({ label: "Streaming", monthlyLimit: 25 }, token));
    expect(create.status).toBe(201);
    const out = (await create.json()) as any;
    expect(out.card.last4).toHaveLength(4);
    expect(out.card.monthly_limit).toBe(25);
    expect(out.secret.number).toBeTruthy(); // dormant provider returns a test PAN once
    const id = out.card.id;

    const list = (await (await app.request("/api/cards", { headers: { authorization: `Bearer ${token}` } })).json()) as any;
    expect(list.cards).toHaveLength(1);

    await app.request(`/api/cards/${id}/freeze`, json({}, token));
    const after = (await (await app.request("/api/cards", { headers: { authorization: `Bearer ${token}` } })).json()) as any;
    expect(after.cards[0].status).toBe("frozen");
  });
});
