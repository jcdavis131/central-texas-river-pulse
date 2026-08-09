import { useState } from "react";
import { CopyButton } from "./ui";

/**
 * Shown exactly once — right after a vault is created or a legacy vault is
 * upgraded. This key is the only escrow path if the master password is lost
 * (spec §4.4), so the user must confirm they've saved it before it disappears.
 */
export function RecoveryKeyNotice({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);

  function download() {
    const blob = new Blob(
      [
        "Veil recovery key\n",
        "==================\n\n",
        recoveryKey + "\n\n",
        "Keep this somewhere safe and private. Anyone with this key can reset your\n",
        "master password and open your vault. If you lose BOTH your password and\n",
        "this key, your encrypted data cannot be recovered.\n",
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veil-recovery-key.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal recovery-modal">
        <span className="empty-emoji">🗝️</span>
        <h2>Save your recovery key</h2>
        <p className="lead">
          This is shown <b>once</b>. It’s the only way back in if you forget your master
          password. Store it in a password manager or somewhere safe offline.
        </p>

        <div className="recovery-key mono">{recoveryKey}</div>

        <div className="recovery-actions">
          <CopyButton value={recoveryKey} label="recovery key" />
          <button className="btn" onClick={download}>Download .txt</button>
        </div>

        <label className="recovery-confirm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>I’ve saved my recovery key somewhere safe.</span>
        </label>

        <button className="btn btn-primary btn-block" disabled={!saved} onClick={onDone}>
          Continue to my vault →
        </button>
      </div>
    </div>
  );
}
