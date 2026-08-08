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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (mode === "create") {
      if (pw.length < 8) return setLocalError("Use at least 8 characters.");
      if (pw !== confirm) return setLocalError("Passwords do not match.");
    }
    setBusy(true);
    try {
      await onSubmit(pw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="brand">
          <span className="brand-mark">◐</span>
          <span className="brand-name">Veil</span>
        </div>
        <p className="lock-tag">
          {mode === "create"
            ? "Set a master password. It never leaves this device and cannot be recovered."
            : "Enter your master password to unlock the vault."}
        </p>
        <form onSubmit={submit}>
          <input
            className="input"
            type="password"
            autoFocus
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            placeholder="Master password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {mode === "create" && (
            <>
              <div className={`strength strength-${strength}`}>
                <div className="strength-bar" style={{ width: `${Math.min(100, bits)}%` }} />
                <span>{pw ? `${strength} · ~${bits} bits` : " "}</span>
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
            {busy ? "Working…" : mode === "create" ? "Create vault" : "Unlock"}
          </button>
        </form>
        <p className="lock-note">
          Zero-knowledge: your data is encrypted with AES-GCM using a key derived
          from this password. Lose it and the vault is unrecoverable.
        </p>
      </div>
    </div>
  );
}
