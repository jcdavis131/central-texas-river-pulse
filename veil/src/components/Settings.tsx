import { useState } from "react";
import { exportEncrypted, importEncrypted } from "../lib/store";
import { getProvider } from "../providers";
import type { Settings as SettingsType } from "../lib/types";

interface Props {
  settings: SettingsType;
  onUpdate: (patch: Partial<SettingsType>) => Promise<void>;
  onChangePassword: (newPassword: string) => Promise<void>;
  onDestroy: () => void;
}

export function Settings({ settings, onUpdate, onChangePassword, onDestroy }: Props) {
  const [forwardEmail, setForwardEmail] = useState(settings.forwardEmail);
  const [forwardPhone, setForwardPhone] = useState(settings.forwardPhone);
  const [saved, setSaved] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const provider = getProvider();

  async function saveForwarding() {
    await onUpdate({ forwardEmail, forwardPhone });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function doExport() {
    const blob = exportEncrypted();
    if (!blob) return;
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "veil-vault-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importEncrypted(String(reader.result));
      alert(ok ? "Backup imported. Reload and unlock with its password." : "Invalid backup file.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="settings">
      <section className="settings-section">
        <h3>Forwarding destinations</h3>
        <p className="hint">
          Where real mail and calls relay to once a live provider is configured.
        </p>
        <label className="input-label">Forward email to</label>
        <input
          className="input"
          type="email"
          placeholder="you@realmail.com"
          value={forwardEmail}
          onChange={(e) => setForwardEmail(e.target.value)}
        />
        <label className="input-label">Relay calls/texts to</label>
        <input
          className="input"
          type="tel"
          placeholder="+1 512 555 0134"
          value={forwardPhone}
          onChange={(e) => setForwardPhone(e.target.value)}
        />
        <button className="btn btn-primary" onClick={saveForwarding}>
          {saved ? "✓ Saved" : "Save"}
        </button>
      </section>

      <section className="settings-section">
        <h3>Provider</h3>
        <p className="hint">
          Active: <strong>{provider.name}</strong> ({provider.live ? "live routing" : "local mock — no external routing"}).
          Wire a real email/telephony/card provider by implementing the adapter
          interfaces in <code>src/providers</code> and calling <code>setProvider()</code>.
        </p>
      </section>

      <section className="settings-section">
        <h3>Master password</h3>
        <input
          className="input"
          type="password"
          placeholder="New master password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        <button
          className="btn"
          onClick={async () => {
            if (newPw.length < 8) return setPwMsg("Use at least 8 characters.");
            await onChangePassword(newPw);
            setNewPw("");
            setPwMsg("Password changed. The vault was re-encrypted.");
          }}
        >
          Change password
        </button>
        {pwMsg && <p className="hint">{pwMsg}</p>}
      </section>

      <section className="settings-section">
        <h3>Backup</h3>
        <p className="hint">Exports the encrypted blob only — safe to store anywhere.</p>
        <div className="row">
          <button className="btn" onClick={doExport}>Export encrypted backup</button>
          <label className="btn">
            Import backup
            <input type="file" accept="application/json" hidden onChange={doImport} />
          </label>
        </div>
      </section>

      <section className="settings-section danger-zone">
        <h3>Danger zone</h3>
        <p className="hint">Permanently erases the local vault. Irreversible without a backup.</p>
        {confirmDestroy ? (
          <button className="btn btn-danger" onClick={onDestroy}>
            Confirm — erase everything
          </button>
        ) : (
          <button className="btn btn-danger-ghost" onClick={() => setConfirmDestroy(true)}>
            Erase vault
          </button>
        )}
      </section>
    </div>
  );
}
