# Veil

An **open-source, self-hostable privacy identity manager** — your own alternative
to commercial masked-identity products. Create a distinct identity for every
service you use: a unique email alias, phone alias, generated persona, strong
password, and TOTP — so your real details are never exposed, and any single
alias can be paused or revoked without touching the rest.

Everything is original code you run yourself. There is no paid tier and nothing
is reverse-engineered from any commercial product — you own the whole stack.

## Highlights

- **Zero-knowledge vault (envelope encryption)** — a random 256-bit vault key
  encrypts everything with AES-256-GCM; that key is itself wrapped by a
  key derived from your master password via PBKDF2-HMAC-SHA256 (210k iterations,
  256-bit salt). The password and keys never leave your device; the server only
  ever stores ciphertext.
- **Recovery key** — a one-time 256-bit recovery key is issued when you create
  your vault. It wraps a second copy of the vault key, so a forgotten master
  password can be reset without data loss. Lose *both* and the data is gone by
  design.
- **Masked email aliases with real forwarding** — a built-in SMTP engine
  receives mail for your alias domain and forwards it to your real inbox
  (`Reply-To` preserved), so replies work transparently.
- **Masked phone numbers** — via Twilio (config-gated): provision numbers and
  relay SMS to your real number.
- **Virtual cards** — via Stripe Issuing (config-gated); dormant mode issues
  Luhn-valid, non-chargeable test tokens.
- **Built-in authenticator (TOTP)** — RFC 6238 codes shown in-app (offline,
  WebCrypto), so you don't need a separate authenticator.
- **Breach monitoring** — checks passwords against HaveIBeenPwned using
  k-anonymity (only a 5-char hash prefix is ever sent).
- **Encrypted multi-device sync** — optional; only the encrypted blob is synced.
- **Identity lifecycle & activity log** — active / paused / muted / revoked
  states plus delete, all recorded locally.
- **Runs local-only or server-backed** — the web app works entirely offline;
  connect a server only when you want forwarding, sync, or breach checks.

## Layout

```
veil/
  web/       React + Vite client (local-first; optional server sync)
  server/    Node API: encrypted sync, alias routing, SMTP forwarding,
             TOTP, breach monitoring, provider adapters
  docker-compose.yml, .env.example
```

## Quick start (dev)

```bash
cd veil
npm install
npm run dev        # web on :5180, server on :8787
```

The web app opens local-only. To enable forwarding/sync, open **Settings → Cloud
sync**, point it at `http://localhost:8787`, and create an account.

## Self-host (Docker)

```bash
cd veil
cp .env.example .env      # edit VEIL_ALIAS_DOMAIN, provider creds, etc.
docker compose up --build
# web: http://localhost:5180   api: http://localhost:8787
```

For real email forwarding: set `VEIL_ALIAS_DOMAIN` to a domain you control,
point its MX record at the inbound SMTP listener (`VEIL_SMTP_INBOUND=true`,
port 2525), and configure an outbound relay (`VEIL_EMAIL_ENABLED=true`,
`SMTP_*`). See `.env.example` for every option.

## Architecture notes

- **What the server can and cannot see.** Vault contents (personas,
  credentials, TOTP secrets) are end-to-end encrypted — the server stores an
  opaque blob. Alias *routing* metadata (`alias → destination`) is stored in the
  clear because the forwarding engine must resolve it at delivery time; that is
  the minimum required to route mail, and it's the only plaintext the server
  holds.
- **Provider adapters** (`server/src/providers/`) implement a common interface.
  Each is *live* only when its credentials are configured and *dormant*
  otherwise, so the whole pipeline is exercisable offline. Real card numbers
  require Stripe Issuing; generated tokens are non-functional test cards.

## Testing

```bash
npm run test        # web (crypto, TOTP, generators) + server
                    # (TOTP RFC vectors, HIBP k-anonymity, auth, mail routing,
                    #  full HTTP API integration)
npm run typecheck
npm run build
```

## Security

- Zero-knowledge by construction: the vault key is wrapped by your master
  password and by a one-time recovery key. Lose **both** and the vault is
  unrecoverable — that's the point.
- Server auth uses scrypt-hashed passwords and random session tokens.
- This is a reference implementation; have a professional review the crypto and
  threat model before relying on it for high-risk use.

## Specification alignment

Veil is modelled on a broader platform specification. Because this is a free,
open-source, self-hosted build, it implements the *software* faithfully and
**does not claim** the parts that are commercial or legal offerings
(compliance certifications, identity-theft insurance, a staffed data-broker
removal service, a hosted VPN, or paid tiers). See
[`docs/SPEC-ALIGNMENT.md`](docs/SPEC-ALIGNMENT.md) for a line-by-line map of
what's implemented, what's provider-gated, what's on the roadmap, and what's
intentionally out of scope.
