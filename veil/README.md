# Veil

A local-first, zero-knowledge **privacy identity manager**. Veil lets you create
a distinct masked identity for every service you sign up for — a unique email
alias, phone alias, generated persona, and strong password — so your real
details are never exposed and any single alias can be paused or revoked without
touching the rest.

This is an **original, self-contained implementation** built from scratch. It is
not affiliated with, and does not reverse-engineer or reuse code from, any
commercial identity-protection product. Every feature is implemented locally, so
there is no paid tier — you own all of it.

## What it does

- **Masked identities** — one bundle per service: email alias, phone alias,
  persona, credentials, and (optionally) a masked card.
- **Zero-knowledge vault** — everything is encrypted at rest with AES-GCM using a
  key derived from your master password via PBKDF2 (210k iterations, SHA-256).
  The password and derived key are never persisted; only ciphertext, the KDF
  salt, and a verifier live in `localStorage`.
- **Generators** — cryptographically strong passwords (with an entropy estimate),
  plausible-but-fake personas, per-service email aliases, and Luhn-valid **test**
  card tokens.
- **Lifecycle** — pause, resume, revoke, rotate password, and delete identities;
  every action is written to a local activity log.
- **Encrypted backup** — export/import the encrypted blob; it's safe to store
  anywhere because it's useless without the master password.

## Architecture

```
src/
  crypto/vault.ts      WebCrypto: PBKDF2 key derivation + AES-GCM seal/open
  lib/store.ts         Encrypted-at-rest persistence (localStorage)
  lib/generators.ts    Passwords, personas, aliases, Luhn test cards
  lib/types.ts         Vault data model
  providers/           Adapter interfaces + LocalMockProvider (default)
  hooks/useVault.ts    React state + persistence wiring
  components/          Lock screen, dashboard, identity detail, activity, settings
```

### Provider adapters

Real masking needs backend services Veil intentionally does **not** bundle:

| Feature          | Requires                                             |
| ---------------- | ---------------------------------------------------- |
| Email forwarding | a mail provider with inbound routing / a webhook     |
| Phone masking    | a telephony provider (e.g. Twilio)                   |
| Virtual cards    | a regulated card-issuing / BaaS provider             |

The shipped default is `LocalMockProvider`, which simulates all of this
on-device so the app is fully functional offline. To enable real routing,
implement the `EmailProvider` / `PhoneProvider` / `CardProvider` interfaces in
`src/providers/` and register your provider with `setProvider()`. No UI or vault
code changes are needed. Generated card numbers are **non-functional test
tokens** and cannot be charged.

## Develop

```bash
cd veil
npm install
npm run dev        # http://localhost:5180
npm run typecheck
npm run test
npm run build
```

## Security notes

- Zero-knowledge by construction: lose the master password and the vault is
  unrecoverable — that's the point.
- Data lives in this browser's `localStorage`. Use the encrypted backup to move
  between devices.
- This is a reference implementation; have a professional review the crypto and
  threat model before relying on it for high-risk use.
