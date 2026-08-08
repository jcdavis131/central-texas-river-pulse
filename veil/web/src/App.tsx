import { useState } from "react";
import { useVault } from "./hooks/useVault";
import { useServer } from "./hooks/useServer";
import { Lock } from "./components/Lock";
import { Dashboard } from "./components/Dashboard";
import { Activity } from "./components/Activity";
import { Settings } from "./components/Settings";

type Tab = "identities" | "activity" | "settings";

export default function App() {
  const vault = useVault();
  const server = useServer();
  const [tab, setTab] = useState<Tab>("identities");

  if (vault.lockState === "loading") {
    return <div className="lock-screen" />;
  }

  if (vault.lockState !== "unlocked") {
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
          <button className={tab === "identities" ? "tab active" : "tab"} onClick={() => setTab("identities")}>
            Identities
          </button>
          <button className={tab === "activity" ? "tab active" : "tab"} onClick={() => setTab("activity")}>
            Activity
          </button>
          <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>
            Settings
          </button>
        </nav>
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
