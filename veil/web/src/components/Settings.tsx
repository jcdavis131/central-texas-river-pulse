import { useState } from "react";
import { exportEncrypted, importEncrypted } from "../lib/store";
import { getProvider } from "../providers";
import type { Settings as SettingsType } from "../lib/types";
import type { ServerApi } from "../hooks/useServer";

interface Props {
  settings: SettingsType;
  server: ServerApi;
  onUpdate: (patch: Partial<SettingsType>) => Promise<void>;
  onChangePassword: (newPassword: string) => Promise<void>;
  onDestroy: () => void;
}

export function Settings({ settings, server, onUpdate, onChangePassword, onDestroy }: Props) {
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
        <h3>Security</h3>
        <p className="hint">Automatically lock the vault after a period of inactivity.</p>
        <label className="input-label">Auto-lock</label>
        <select
          className="input select"
          value={String(settings.autoLockMinutes ?? 15)}
          onChange={(e) => onUpdate({ autoLockMinutes: Number(e.target.value) })}
        >
          <option value="0">Never</option>
          <option value="1">After 1 minute</option>
          <option value="5">After 5 minutes</option>
          <option value="15">After 15 minutes</option>
          <option value="30">After 30 minutes</option>
          <option value="60">After 1 hour</option>
        </select>
        <p className="hint">Theme (light / dark / system) is the ☀️/🌙/🖥 button in the top bar.</p>
      </section>

      <ServerSync server={server} />

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

function ServerSync({ server }: { server: ServerApi }) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8787");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");
  const [msg, setMsg] = useState<string | null>(null);

  if (server.connected) {
    return (
      <section className="settings-section">
        <h3>Cloud sync ☁</h3>
        <p className="hint">
          Connected to <strong>{server.baseUrl}</strong> as <strong>{server.email}</strong>.
          {server.health && (
            <>
              {" "}Providers — email:{server.health.providers.email ? "live" : "dormant"},
              phone:{server.health.providers.phone ? "live" : "dormant"},
              card:{server.health.providers.card ? "live" : "dormant"}.
            </>
          )}
        </p>
        <p className="hint">
          Sync pushes only the <em>encrypted</em> vault blob — the server never sees your master
          password or plaintext.
        </p>
        <div className="row">
          <button
            className="btn"
            disabled={server.busy}
            onClick={async () => setMsg((await server.syncPush()) ? "Pushed encrypted vault to server." : "Push failed.")}
          >
            ↑ Push
          </button>
          <button
            className="btn"
            disabled={server.busy}
            onClick={async () => {
              const r = await server.syncPull();
              if (r === "updated") {
                setMsg("Pulled a newer vault — reloading…");
                setTimeout(() => window.location.reload(), 700);
              } else {
                setMsg(r === "empty" ? "Nothing stored on the server yet." : "Already up to date.");
              }
            }}
          >
            ↓ Pull
          </button>
          <button className="btn btn-danger-ghost" onClick={server.disconnect}>
            Disconnect
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h3>Cloud sync ☁</h3>
      <p className="hint">
        Optional. Connect a self-hosted Veil server for encrypted multi-device sync, real email
        forwarding, and breach checks. Local-only mode works without this.
      </p>
      <label className="input-label">Server URL</label>
      <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      <label className="input-label">Account email</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="input-label">Account password</label>
      <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="toggles">
        <label className="toggle">
          <input type="radio" checked={mode === "register"} onChange={() => setMode("register")} /> Create account
        </label>
        <label className="toggle">
          <input type="radio" checked={mode === "login"} onChange={() => setMode("login")} /> Sign in
        </label>
      </div>
      {server.error && <p className="error">{server.error}</p>}
      <button
        className="btn btn-primary"
        disabled={server.busy || !email || !password}
        onClick={() => server.connect(baseUrl, email, password, mode)}
      >
        {server.busy ? "Connecting…" : mode === "register" ? "Create & connect" : "Sign in & connect"}
      </button>
    </section>
  );
}
