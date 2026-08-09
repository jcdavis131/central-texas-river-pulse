import { useState } from "react";
import { useVault } from "./hooks/useVault";
import { useServer } from "./hooks/useServer";
import { useTheme } from "./hooks/useTheme";
import { useIdleLock } from "./hooks/useIdleLock";
import { Lock } from "./components/Lock";
import { Dashboard } from "./components/Dashboard";
import { Security } from "./components/Security";
import { Generator } from "./components/Generator";
import { Activity } from "./components/Activity";
import { Settings } from "./components/Settings";

type Tab = "identities" | "security" | "generator" | "activity" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "identities", label: "Identities" },
  { id: "security", label: "Security" },
  { id: "generator", label: "Generator" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const THEME_ICON = { system: "🖥", light: "☀️", dark: "🌙" } as const;

export default function App() {
  const vault = useVault();
  const server = useServer();
  const { theme, cycle } = useTheme();
  const [tab, setTab] = useState<Tab>("identities");

  const unlocked = vault.lockState === "unlocked";
  useIdleLock(vault.state.settings.autoLockMinutes ?? 15, unlocked, vault.lock);

  if (vault.lockState === "loading") {
    return <div className="landing" />;
  }

  if (!unlocked) {
    return (
      <Lock
        mode={vault.lockState === "uninitialized" ? "create" : "unlock"}
        error={vault.error}
        onSubmit={async (pw) => {
          if (vault.lockState === "uninitialized") {
            await vault.initialize(pw);
          } else {
            await vault.unlock(pw);
          }
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◐</span>
          <span className="brand-name">Veil</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="header-spacer" />
        <button className="btn btn-ghost" onClick={cycle} title={`Theme: ${theme}`} aria-label="Toggle theme">
          {THEME_ICON[theme]}
        </button>
        <button className="btn btn-ghost" onClick={vault.lock} title="Lock vault">
          🔒 Lock
        </button>
      </header>

      <main className="app-main">
        {tab === "identities" && (
          <Dashboard
            state={vault.state}
            server={server}
            onCreate={vault.addIdentity}
            onStatus={vault.setIdentityStatus}
            onUpdate={vault.updateIdentity}
            onRemove={vault.removeIdentity}
            log={vault.log}
          />
        )}
        {tab === "security" && <Security state={vault.state} server={server} />}
        {tab === "generator" && <Generator />}
        {tab === "activity" && <Activity state={vault.state} />}
        {tab === "settings" && (
          <Settings
            settings={vault.state.settings}
            server={server}
            onUpdate={vault.updateSettings}
            onChangePassword={vault.changePassword}
            onDestroy={vault.destroy}
          />
        )}
      </main>
    </div>
  );
}
