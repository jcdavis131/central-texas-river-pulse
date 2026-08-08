import { useEffect, useState } from "react";
import { Modal, Field, StatusBadge, Dot } from "./ui";
import type { Identity } from "../lib/types";
import { generatePassword, passwordEntropyBits } from "../lib/generators";
import { totp, totpRemaining, randomBase32Secret } from "../lib/totp";
import type { ServerApi } from "../hooks/useServer";

interface Props {
  identity: Identity;
  server: ServerApi;
  onClose: () => void;
  onStatus: (status: Identity["status"]) => void;
  onUpdate: (patch: Partial<Identity>) => void;
  onRemove: () => void;
}

export function IdentityDetail({ identity, server, onClose, onStatus, onUpdate, onRemove }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const secret = identity.secret;

  function rotatePassword() {
    const password = generatePassword();
    onUpdate({ secret: { ...(secret ?? { username: identity.emailAlias, password }), password } });
  }

  return (
    <Modal title={identity.label} onClose={onClose} wide>
      <div className="detail-head">
        <Dot color={identity.color} />
        <StatusBadge status={identity.status} />
        <span className="detail-created">
          created {new Date(identity.createdAt).toLocaleDateString()}
        </span>
      </div>

      <section className="detail-section">
        <h3>Masked contact</h3>
        <Field label="Email alias" value={identity.emailAlias} mono copy />
        {identity.phoneAlias && <Field label="Phone alias" value={identity.phoneAlias} mono copy />}
      </section>

      {secret && (
        <section className="detail-section">
          <h3>Credentials</h3>
          <Field label="Username" value={secret.username} mono copy />
          <div className="field">
            <span className="field-label">Password</span>
            <span className="field-value mono">
              {showPassword ? secret.password : "•".repeat(Math.min(20, secret.password.length))}
              <button className="copy-btn" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "hide" : "show"}
              </button>
              <button className="copy-btn" onClick={rotatePassword}>rotate</button>
            </span>
          </div>
          <p className="hint">~{passwordEntropyBits(secret.password)} bits of entropy</p>
          <BreachCheck password={secret.password} server={server} />
        </section>
      )}

      <TotpSection identity={identity} onUpdate={onUpdate} />

      <section className="detail-section">
        <h3>Persona</h3>
        <Field label="Name" value={`${identity.persona.firstName} ${identity.persona.lastName}`} copy />
        <Field label="Date of birth" value={identity.persona.dateOfBirth} copy />
        <Field
          label="Address"
          value={`${identity.persona.street}, ${identity.persona.city}, ${identity.persona.state} ${identity.persona.zip}`}
          copy
        />
      </section>

      {identity.card && (
        <section className="detail-section">
          <h3>Masked card <span className="tag-test">test token</span></h3>
          <Field label="Number" value={identity.card.number} mono copy />
          <Field
            label="Expires"
            value={`${String(identity.card.expMonth).padStart(2, "0")}/${identity.card.expYear}`}
            mono
          />
          <Field label="CVC" value={identity.card.cvc} mono copy />
          <p className="hint">Non-functional test number. Cannot be charged.</p>
        </section>
      )}

      <div className="modal-actions">
        {identity.status === "active" ? (
          <button className="btn" onClick={() => onStatus("paused")}>Pause</button>
        ) : identity.status === "paused" ? (
          <button className="btn" onClick={() => onStatus("active")}>Resume</button>
        ) : null}
        {identity.status !== "revoked" && (
          <button className="btn btn-warn" onClick={() => onStatus("revoked")}>Revoke</button>
        )}
        <div className="spacer" />
        {confirmRemove ? (
          <button className="btn btn-danger" onClick={onRemove}>Confirm delete</button>
        ) : (
          <button className="btn btn-danger-ghost" onClick={() => setConfirmRemove(true)}>
            Delete
          </button>
        )}
      </div>
    </Modal>
  );
}

function BreachCheck({ password, server }: { password: string; server: ServerApi }) {
  const [state, setState] = useState<"idle" | "checking" | "done" | "error">("idle");
  const [result, setResult] = useState<{ breached: boolean; count: number } | null>(null);

  if (!server.connected) {
    return <p className="hint">Connect a server (Settings) to check this password against breach data.</p>;
  }

  return (
    <div className="breach">
      <button
        className="btn"
        disabled={state === "checking"}
        onClick={async () => {
          setState("checking");
          try {
            setResult(await server.checkBreach(password));
            setState("done");
          } catch {
            setState("error");
          }
        }}
      >
        {state === "checking" ? "Checking…" : "Check breach exposure"}
      </button>
      {state === "done" && result && (
        <span className={result.breached ? "breach-bad" : "breach-ok"}>
          {result.breached
            ? `⚠ seen in ${result.count.toLocaleString()} breaches — rotate it`
            : "✓ not found in known breaches"}
        </span>
      )}
      {state === "error" && <span className="breach-bad">breach check failed</span>}
    </div>
  );
}

function TotpSection({
  identity,
  onUpdate,
}: {
  identity: Identity;
  onUpdate: (patch: Partial<Identity>) => void;
}) {
  const totpSecret = identity.secret?.totpSecret;
  const [code, setCode] = useState("------");
  const [remaining, setRemaining] = useState(30);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState("");

  useEffect(() => {
    if (!totpSecret) return;
    let active = true;
    const tick = async () => {
      try {
        const c = await totp(totpSecret);
        if (active) {
          setCode(c);
          setRemaining(totpRemaining());
        }
      } catch {
        if (active) setCode("bad key");
      }
    };
    void tick();
    const id = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [totpSecret]);

  function saveSecret(raw: string) {
    const base = identity.secret ?? { username: identity.emailAlias, password: "" };
    onUpdate({ secret: { ...base, totpSecret: raw.replace(/\s+/g, "") } });
    setAdding(false);
    setEntry("");
  }

  function removeSecret() {
    if (!identity.secret) return;
    const next = { ...identity.secret };
    delete next.totpSecret;
    onUpdate({ secret: next });
  }

  return (
    <section className="detail-section">
      <h3>Authenticator (TOTP)</h3>
      {totpSecret ? (
        <>
          <div className="field">
            <span className="field-label">Current code</span>
            <span className="field-value mono totp-code">
              {code}
              <span className="totp-remaining">{remaining}s</span>
            </span>
          </div>
          <button className="copy-btn" onClick={removeSecret}>remove</button>
        </>
      ) : adding ? (
        <>
          <input
            className="input"
            placeholder="Paste base32 secret, or generate one"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
          <div className="row">
            <button className="btn" onClick={() => setEntry(randomBase32Secret())}>Generate</button>
            <button className="btn btn-primary" disabled={!entry} onClick={() => saveSecret(entry)}>Save</button>
            <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>+ Add TOTP secret</button>
      )}
    </section>
  );
}
