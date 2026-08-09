import { useState } from "react";
import { useVault } from "./hooks/useVault";
import { useServer } from "./hooks/useServer";
import { useTheme } from "./hooks/useTheme";
import { useIdleLock } from "./hooks/useIdleLock";
import { Lock } from "./components/Lock";
import { Dashboard } from "./components/Dashboard";
import { Inbox } from "./components/Inbox";
import { Cards } from "./components/Cards";
import { Security } from "./components/Security";
import { Generator } from "./components/Generator";
import { Activity } from "./components/Activity";
import { Settings } from "./components/Settings";

type Tab = "identities" | "inbox" | "cards" | "security" | "generator" | "activity" | "settings";

const THEME_ICON = { system: "🖥", light: "☀️", dark: "🌙" } as const;

export default function App() {
  const vault = useVault();
  const server = useServer();
  const { theme, cycle } = useTheme();
  const [tab, setTab] = useState<Tab>("identities");

  const unlocked = vault.lockState === "unlocked";
  useIdleLock(vault.state.settings.autoLockMinutes ?? 15, unlocked, vault.lock);

  const tabs: { id: Tab; label: string }[] = [
    { id: "identities", label: "Identities" },
    ...(server.connected
      ? ([
          { id: "inbox", label: "Inbox" },
          { id: "cards", label: "Cards" },
        ] as { id: Tab; label: string }[])
      : []),
    { id: "security", label: "Security" },
    { id: "generator", label: "Generator" },
    { id: "activity", label: "Activity" },
    { id: "settings", label: "Settings" },
  ];

  // If a server-only tab is selected but we're not connected, fall back.
  const view: Tab = (tab === "inbox" || tab === "cards") && !server.connected ? "identities" : tab;

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
          {tabs.map((t) => (
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
        {view === "identities" && (
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
        {view === "inbox" && <Inbox server={server} />}
        {view === "cards" && <Cards server={server} />}
        {view === "security" && <Security state={vault.state} server={server} />}
        {view === "generator" && <Generator />}
        {view === "activity" && <Activity state={vault.state} />}
        {view === "settings" && (
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
