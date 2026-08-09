import { useState } from "react";
import { passwordEntropyBits } from "../lib/generators";

interface Props {
  mode: "create" | "unlock";
  error: string | null;
  onSubmit: (password: string) => Promise<void> | void;
}

export function Lock({ mode, error, onSubmit }: Props) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const bits = passwordEntropyBits(pw);
  const strength = bits < 40 ? "weak" : bits < 70 ? "fair" : "strong";
  const creating = mode === "create";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (creating) {
      if (pw.length < 8) return setLocalError("Use at least 8 characters.");
      if (pw !== confirm) return setLocalError("Those passwords don’t match.");
    }
    setBusy(true);
    try {
      await onSubmit(pw);
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
          <h2>{creating ? "Create your vault" : "Unlock vault"}</h2>
          <p className="lead">
            {creating
              ? "Choose a master password. It stays on this device and can’t be recovered — so make it memorable."
              : "Enter your master password."}
          </p>

          <form onSubmit={submit}>
            <input
              className="input"
              type="password"
              autoFocus
              autoComplete={creating ? "new-password" : "current-password"}
              placeholder="Master password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />

            {creating && (
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
              {busy ? "One moment…" : creating ? "Create vault →" : "Unlock →"}
            </button>
          </form>

          <p className="lock-note">
            🔒 Zero-knowledge by design. Everything is encrypted with AES-GCM using a key
            derived from your password — we never see it.
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
