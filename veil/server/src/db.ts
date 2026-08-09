import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";

// Load node:sqlite via createRequire so bundlers/test transformers (which may
// not yet recognize this newer builtin) don't try to transform it — the type is
// imported separately with `import type`, which is fully erased at build time.
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");

/**
 * SQLite persistence via the built-in node:sqlite module (no native build step).
 *
 * Zero-knowledge note: `vault_blobs.ciphertext` is encrypted client-side and the
 * server can never read it. `aliases` intentionally stores routing metadata
 * (alias -> destination) in the clear because the forwarding engine must resolve
 * it at delivery time — this is the minimum the server must know to route mail.
 */

export interface UserRow {
  id: string;
  email: string;
  pw_hash: string;
  pw_salt: string;
  created_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface VaultRow {
  user_id: string;
  version: number;
  ciphertext: string;
  iv: string;
  updated_at: string;
}

export type AliasKind = "email" | "phone" | "card";
export type AliasStatus = "active" | "paused" | "revoked";

export interface AliasRow {
  id: string;
  user_id: string;
  address: string;
  destination: string;
  kind: AliasKind;
  label: string;
  status: AliasStatus;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  user_id: string;
  at: string;
  kind: string;
  detail: string;
}

/** A message received at an alias and forwarded — kept so the user can read it in-app. */
export interface MessageRow {
  id: string;
  user_id: string;
  alias_address: string;
  from_addr: string;
  subject: string;
  body: string;
  received_at: string;
  read: number; // 0 | 1
}

export interface CardRow {
  id: string;
  user_id: string;
  provider_id: string; // id from the issuer (or a test id)
  label: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  monthly_limit: number | null;
  status: string; // active | frozen
  created_at: string;
}

export class Db {
  private db: DatabaseSyncType;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        pw_hash TEXT NOT NULL,
        pw_salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vault_blobs (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS aliases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        address TEXT UNIQUE NOT NULL,
        destination TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_aliases_user ON aliases(user_id);
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,
        detail TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alias_address TEXT NOT NULL,
        from_addr TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        received_at TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        label TEXT NOT NULL,
        last4 TEXT NOT NULL,
        brand TEXT NOT NULL,
        exp_month INTEGER NOT NULL,
        exp_year INTEGER NOT NULL,
        monthly_limit INTEGER,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
    `);
  }

  // ---- users ----
  createUser(row: UserRow): void {
    this.db
      .prepare(
        "INSERT INTO users (id, email, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(row.id, row.email, row.pw_hash, row.pw_salt, row.created_at);
  }

  getUserByEmail(email: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  }

  getUserById(id: string): UserRow | undefined {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  }

  // ---- sessions ----
  createSession(row: SessionRow): void {
    this.db
      .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(row.token, row.user_id, row.created_at, row.expires_at);
  }

  getSession(token: string): SessionRow | undefined {
    return this.db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as
      | SessionRow
      | undefined;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  deleteExpiredSessions(nowIso: string): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso);
  }

  // ---- vault blobs ----
  getVault(userId: string): VaultRow | undefined {
    return this.db.prepare("SELECT * FROM vault_blobs WHERE user_id = ?").get(userId) as
      | VaultRow
      | undefined;
  }

  upsertVault(row: VaultRow): void {
    this.db
      .prepare(
        `INSERT INTO vault_blobs (user_id, version, ciphertext, iv, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           version = excluded.version,
           ciphertext = excluded.ciphertext,
           iv = excluded.iv,
           updated_at = excluded.updated_at`,
      )
      .run(row.user_id, row.version, row.ciphertext, row.iv, row.updated_at);
  }

  // ---- aliases ----
  createAlias(row: AliasRow): void {
    this.db
      .prepare(
        `INSERT INTO aliases (id, user_id, address, destination, kind, label, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.user_id,
        row.address,
        row.destination,
        row.kind,
        row.label,
        row.status,
        row.created_at,
      );
  }

  listAliases(userId: string): AliasRow[] {
    return this.db
      .prepare("SELECT * FROM aliases WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as unknown as AliasRow[];
  }

  getAliasByAddress(address: string): AliasRow | undefined {
    return this.db.prepare("SELECT * FROM aliases WHERE address = ?").get(address) as
      | AliasRow
      | undefined;
  }

  setAliasStatus(id: string, userId: string, status: AliasStatus): void {
    this.db
      .prepare("UPDATE aliases SET status = ? WHERE id = ? AND user_id = ?")
      .run(status, id, userId);
  }

  deleteAlias(id: string, userId: string): void {
    this.db.prepare("DELETE FROM aliases WHERE id = ? AND user_id = ?").run(id, userId);
  }

  // ---- activity ----
  addActivity(row: ActivityRow): void {
    this.db
      .prepare("INSERT INTO activity (id, user_id, at, kind, detail) VALUES (?, ?, ?, ?, ?)")
      .run(row.id, row.user_id, row.at, row.kind, row.detail);
  }

  listActivity(userId: string, limit = 200): ActivityRow[] {
    return this.db
      .prepare("SELECT * FROM activity WHERE user_id = ? ORDER BY at DESC LIMIT ?")
      .all(userId, limit) as unknown as ActivityRow[];
  }

  // ---- messages (inbox) ----
  addMessage(row: MessageRow): void {
    this.db
      .prepare(
        `INSERT INTO messages (id, user_id, alias_address, from_addr, subject, body, received_at, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.user_id,
        row.alias_address,
        row.from_addr,
        row.subject,
        row.body,
        row.received_at,
        row.read,
      );
  }

  listMessages(userId: string, aliasAddress?: string, limit = 200): MessageRow[] {
    if (aliasAddress) {
      return this.db
        .prepare(
          "SELECT * FROM messages WHERE user_id = ? AND alias_address = ? ORDER BY received_at DESC LIMIT ?",
        )
        .all(userId, aliasAddress, limit) as unknown as MessageRow[];
    }
    return this.db
      .prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY received_at DESC LIMIT ?")
      .all(userId, limit) as unknown as MessageRow[];
  }

  getMessage(id: string, userId: string): MessageRow | undefined {
    return this.db.prepare("SELECT * FROM messages WHERE id = ? AND user_id = ?").get(id, userId) as
      | MessageRow
      | undefined;
  }

  markMessageRead(id: string, userId: string, read = 1): void {
    this.db.prepare("UPDATE messages SET read = ? WHERE id = ? AND user_id = ?").run(read, id, userId);
  }

  deleteMessage(id: string, userId: string): void {
    this.db.prepare("DELETE FROM messages WHERE id = ? AND user_id = ?").run(id, userId);
  }

  countUnread(userId: string): number {
    const r = this.db
      .prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND read = 0")
      .get(userId) as { n: number } | undefined;
    return r?.n ?? 0;
  }

  // ---- cards ----
  addCard(row: CardRow): void {
    this.db
      .prepare(
        `INSERT INTO cards (id, user_id, provider_id, label, last4, brand, exp_month, exp_year, monthly_limit, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.user_id,
        row.provider_id,
        row.label,
        row.last4,
        row.brand,
        row.exp_month,
        row.exp_year,
        row.monthly_limit,
        row.status,
        row.created_at,
      );
  }

  listCards(userId: string): CardRow[] {
    return this.db
      .prepare("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as unknown as CardRow[];
  }

  getCard(id: string, userId: string): CardRow | undefined {
    return this.db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(id, userId) as
      | CardRow
      | undefined;
  }

  setCardStatus(id: string, userId: string, status: string): void {
    this.db.prepare("UPDATE cards SET status = ? WHERE id = ? AND user_id = ?").run(status, id, userId);
  }

  close(): void {
    this.db.close();
  }
}
