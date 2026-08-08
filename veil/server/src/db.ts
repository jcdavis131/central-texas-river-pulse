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

  close(): void {
    this.db.close();
  }
}
