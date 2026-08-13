import { useState } from "react";
import { passwordEntropyBits } from "../lib/generators";

interface Props {
  mode: "create" | "unlock";
  error: string | null;
  onSubmit: (password: string) => Promise<void> | void;
  onRecover: (recoveryKey: string, newPassword: string) => Promise<void> | void;
}

export function Lock({ mode, error, onSubmit, onRecover }: Props) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const bits = passwordEntropyBits(pw);
  const strength = bits < 40 ? "weak" : bits < 70 ? "fair" : "strong";
  const creating = mode === "create";
  const needsConfirm = creating || recovering;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (recovering && recoveryKey.replace(/[\s-]/g, "").length < 16) {
      return setLocalError("Enter your full recovery key.");
    }
    if (needsConfirm) {
      if (pw.length < 8) return setLocalError("Use at least 8 characters.");
      if (pw !== confirm) return setLocalError("Those passwords don’t match.");
    }
    setBusy(true);
    try {
      if (recovering) await onRecover(recoveryKey, pw);
      else await onSubmit(pw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="wordmark">
          <span className="mark">◐</span>
          <span className="name">Veil</span>
        </div>

        {creating ? (
          <>
            <h1 className="hero-title">
              Your identity,<br />
              on <em>your</em> terms.
            </h1>
            <p className="hero-sub">
              A private place to keep a separate identity for every service — so your
              real details never spread across the internet.
            </p>
          </>
        ) : (
          <>
            <h1 className="hero-title">Welcome back.</h1>
            <p className="hero-sub">Unlock your vault to pick up where you left off.</p>
          </>
        )}

        <div className="auth-card">
          <h2>{creating ? "Create your vault" : recovering ? "Recover your vault" : "Unlock vault"}</h2>
          <p className="lead">
            {creating
              ? "Choose a master password. You’ll get a one-time recovery key so a forgotten password isn’t the end of the road."
              : recovering
                ? "Enter your recovery key and choose a new master password."
                : "Enter your master password."}
          </p>

          <form onSubmit={submit}>
            {recovering && (
              <input
                className="input mono"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="Recovery key (XXXX-XXXX-…)"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
              />
            )}

            <input
              className="input"
              type="password"
              autoFocus={!recovering}
              autoComplete={needsConfirm ? "new-password" : "current-password"}
              placeholder={recovering ? "New master password" : "Master password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />

            {needsConfirm && (
              <>
                <div className={`strength strength-${strength}`}>
                  <div className="strength-track">
                    <div className="strength-fill" style={{ width: `${Math.min(100, bits)}%` }} />
                  </div>
                  <span className="strength-label">
                    {pw ? `${strength[0].toUpperCase()}${strength.slice(1)} · ~${bits} bits of entropy` : " "}
                  </span>
                </div>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm master password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </>
            )}

            {(localError || error) && <p className="error">{localError ?? error}</p>}

            <button className="btn btn-primary btn-block" disabled={busy || !pw}>
              {busy
                ? "One moment…"
                : creating
                  ? "Create vault →"
                  : recovering
                    ? "Recover vault →"
                    : "Unlock →"}
            </button>
          </form>

          {!creating && (
            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                setRecovering((r) => !r);
                setLocalError(null);
                setPw("");
                setConfirm("");
              }}
            >
              {recovering ? "← Back to unlock" : "Forgot your master password?"}
            </button>
          )}

          <p className="lock-note">
            🔒 Zero-knowledge by design. A random vault key encrypts everything with
            AES-256-GCM and is itself wrapped by your password — we never see either.
          </p>
        </div>

        <div className="trust-row">
          <span className="trust">🛡️ <b>Zero-knowledge</b></span>
          <span className="trust">📴 <b>Works offline</b></span>
          <span className="trust">🧩 <b>Open source</b></span>
        </div>

        <p className="landing-foot">You hold the only key. No account required to start.</p>
      </div>
    </div>
  );
}
