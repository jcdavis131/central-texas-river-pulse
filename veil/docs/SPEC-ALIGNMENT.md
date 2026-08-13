# Veil — Specification Alignment

This document maps the [Veil Platform Technical & Product Specification](https://docs.google.com/document/d/1LsMP9khaLAvTeCH66D3TQvbN53RTQVE21PVoBz4r1VQ/edit)
to what this open-source repository actually implements.

**Guiding principle: honesty over marketing.** The specification describes an
enterprise commercial product. This repo is a self-hostable, open-source
implementation built for personal use. Where the spec describes a *capability
we implement*, we implement it for real. Where it describes a *commercial
service, legal program, certification, or third-party infrastructure* we cannot
truthfully provide as an open-source project, we say so plainly rather than
claim it. **Veil never advertises a protection it does not deliver.**

Status legend:

- ✅ **Implemented** — working in this repo today.
- 🔌 **Architecture-ready** — code path exists; lights up when you supply a
  provider/API key (self-hosted).
- 🗺️ **Roadmap** — designed for, not yet built.
- 🚫 **Out of scope (OSS)** — a commercial/legal/certification claim an
  open-source self-host build cannot and should not assert.

---

## 2. Technical & Compliance Standards

| Spec item | Status | Notes |
|---|---|---|
| Zero-knowledge client-side AES-256-GCM | ✅ | `web/src/crypto/vault.ts` — AES-256-GCM, PBKDF2-HMAC-SHA256 (210k iters), 256-bit salt. |
| Per-user database isolation partitions | 🗺️ | Server uses per-user rows with server-side access scoping, not physical partitions. Ciphertext is opaque to the server regardless. |
| SOC 2 Type II, ISO 27001/27701, PCI DSS L1 | 🚫 | Certifications are audits of an operated business, not code. This repo makes **no** compliance claims. Self-hosters are responsible for their own posture. |
| Browser extensions (Chrome/FF/Edge/Safari) | 🗺️ | Web portal only today. Autofill needs an extension. |
| Web portal | ✅ | The `web/` app. |
| Native iOS / Android apps | 🗺️ | Not built. |
| WebAuthn / FIDO2 / Passkeys | 🗺️ | Not yet. Password + recovery key + TOTP today. |
| MFA | 🔌 | TOTP is generated/stored per identity; account-level MFA on the server is roadmap. |
| Local TOTP generation | ✅ | `web/src/lib/totp.ts` + `server/src/totp.ts` (RFC 6238). |

## 3. Core Platform Modules

### 3.1 Virtual Identities (Aliasing & Masking)
| Spec item | Status | Notes |
|---|---|---|
| On-demand email / phone / credential generation | ✅ (email/creds) / 🔌 (phone) | Aliases + personas + credentials generated locally; phone provisioning needs a Twilio key. |
| Autofill into browser | 🗺️ | Requires the browser extension. |
| Bi-directional router (email / SMS / voice) | ✅ (email) / 🔌 (SMS+voice) | Real SMTP forwarding engine in `server/src/mailer/`; SMS/voice via the Twilio adapter when configured. |
| Stateful controls (Active / Paused / Muted / Revoked) | ✅ | `IdentityStatus` in `web/src/lib/types.ts`; toggles in the identity detail view. ("Deleted" = hard remove.) |
| Native OTP interception & autofill | 🔌 / 🗺️ | TOTP codes are generated in-app; interception into login screens needs the extension. |

### 3.2 Data Broker Automated Removal
| Spec item | Status | Notes |
|---|---|---|
| Opt-out across 1,000+ brokers, continuous re-audit | 🚫 | This is a staffed commercial service (legal opt-out ops + broker relationships). Out of scope for an OSS build; we will not fake a "removed" status. |

### 3.3 Call Guard & Telephony Security
| Spec item | Status | Notes |
|---|---|---|
| Spam filtering, AI vishing interception at carrier edge | 🔌 / 🗺️ | Basic call/SMS relay via Twilio when configured; carrier-edge spam/AI interception is a provider capability, not implemented here. |

### 3.4 Zero-Knowledge Password Vault
| Spec item | Status | Notes |
|---|---|---|
| Client-side encryption of passwords, notes, payment keys | ✅ | Whole vault is sealed client-side; `Secret` (username/password/TOTP/notes) + `Card` live per identity. |
| Credentials mapped to their virtual email/phone identity | ✅ | Secrets/cards are fields on each `Identity`. |

### 3.5 Threat Intelligence & Recovery
| Spec item | Status | Notes |
|---|---|---|
| Breach / dark-web monitoring | ✅ (password) / 🗺️ (email/SSN/dark web) | HaveIBeenPwned k-anonymity password check (`server/src/breach.ts`). Broader monitoring is roadmap. |
| $1,000,000 identity theft insurance | 🚫 | An insurance/legal product, not software. Not offered. |

### 3.6 Veil Network & Veil Pay
| Spec item | Status | Notes |
|---|---|---|
| Veil VPN | 🚫 | Running a VPN is infrastructure/ops, not part of this repo. |
| Veil Pay — single-use / merchant-locked virtual cards | ✅ (test tokens) / 🔌 (real) | Cards feature issues Luhn-valid test tokens offline; real spend-limited cards via a Stripe Issuing key. |

## 4. Technical Security Architecture

### 4.1 Zero-Knowledge Key Derivation Pipeline
| Spec step | Status | Notes |
|---|---|---|
| 256-bit random salt | ✅ | `SALT_BYTES = 32`. |
| Memory-hard KDF (Argon2id **or** PBKDF2-HMAC-SHA256) | ✅ | PBKDF2-HMAC-SHA256 @ 210k iterations (the spec lists it as an accepted option). Argon2id is a possible upgrade. |
| VEK unwrapping | ✅ | Random 256-bit VEK, wrapped by a password-derived KEK. `newVek` / `wrapVek` / `unwrapVek`. |
| Envelope encryption | ✅ (vault-level) | The VEK encrypts the vault; changing the password re-wraps the VEK without re-encrypting data. Per-record keys are a possible future refinement. |
| Memory hygiene / scrub on lock | ⚠️ Partial | On lock we drop the CryptoKey reference and clear in-memory state. WebCrypto keys are opaque/non-extractable at rest and cannot be zeroed by JS — this is the honest ceiling for a browser runtime. |

### 4.2 Isolated Per-User Database
| Spec item | Status | Notes |
|---|---|---|
| Logical/physical per-user partitions | 🗺️ | Per-user row scoping today; the stored payload is client-encrypted ciphertext either way. |
| At-rest double encryption | 🔌 | Disk encryption is a deployment concern; the app layer already stores only ciphertext. |
| Client-side indexing (no plaintext to server) | ✅ | Search/filter run in the client over the decrypted vault; the server only ever sees ciphertext. |

### 4.4 Emergency Recovery & Key Management
| Spec item | Status | Notes |
|---|---|---|
| 256-bit recovery key issued at creation | ✅ | `newRecoveryKey()` — shown once via `RecoveryKeyNotice`. |
| Escrow: VEK wrapped by the recovery key | ✅ | Second wrap `wrapRec`; `recover()` unwraps and re-wraps under a new password. |
| Hard-reset boundary (lose both = unrecoverable data) | ✅ | Documented in the recovery UI; alias forwarding rules live server-side and survive. |

## 5. Offerings & Tier Structure
| Spec item | Status | Notes |
|---|---|---|
| Paid Individual/Couple/Family tiers | 🚫 **Intentionally omitted** | This is a free, open-source, self-hosted tool. There are no paywalls, tiers, or billing. Every capability above is available to anyone who self-hosts. |

---

## Summary

- **Cryptographic core, aliasing, stateful controls, vault, TOTP, breach check,
  email forwarding, and recovery** are implemented for real.
- **Phone/SMS/voice, real payment cards, and richer monitoring** are
  architecture-ready and light up with your own provider keys.
- **Extensions, native apps, WebAuthn/passkeys, and per-user partitions** are
  roadmap.
- **Certifications, identity-theft insurance, the data-broker removal service,
  a VPN, and paid tiers** are deliberately **not claimed** — they are commercial
  or legal offerings, not software this repo can honestly provide.
