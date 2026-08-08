import { useState } from "react";
import { Dot, StatusBadge } from "./ui";
import { CreateIdentity } from "./CreateIdentity";
import { IdentityDetail } from "./IdentityDetail";
import type { Identity, Settings, VaultState } from "../lib/types";
import type { ActivityKind } from "../lib/types";
import type { ServerApi } from "../hooks/useServer";

interface Props {
  state: VaultState;
  server: ServerApi;
  onCreate: (identity: Identity) => Promise<void>;
  onStatus: (id: string, status: Identity["status"]) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Identity>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  log: (kind: ActivityKind, detail: string, identityId?: string) => Promise<void>;
}

export function Dashboard({ state, server, onCreate, onStatus, onUpdate, onRemove, log }: Props) {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const settings: Settings = state.settings;
  const identities = state.identities.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase()),
  );
  const active = state.identities.filter((i) => i.status === "active").length;
  const selected = state.identities.find((i) => i.id === selectedId) ?? null;

  async function handleCreate(identity: Identity) {
    let toStore = identity;
    // When connected to a server, register a real forwarding alias so mail to it
    // actually reaches the configured inbox; use the server-issued address.
    if (server.connected && state.settings.forwardEmail) {
      try {
        const address = await server.provisionEmailAlias(identity.label, state.settings.forwardEmail);
        if (address) {
          toStore = {
            ...identity,
            emailAlias: address,
            secret: identity.secret ? { ...identity.secret, username: address } : identity.secret,
          };
        }
      } catch {
        /* fall back to the locally generated alias */
      }
    }
    await onCreate(toStore);
    await log("identity_created", `Created masked identity “${toStore.label}”`, toStore.id);
  }

  async function handleStatus(id: string, status: Identity["status"]) {
    await onStatus(id, status);
    const kind: ActivityKind =
      status === "revoked"
        ? "identity_revoked"
        : status === "paused"
          ? "identity_paused"
          : "identity_resumed";
    const label = state.identities.find((i) => i.id === id)?.label ?? "identity";
    await log(kind, `${status[0].toUpperCase()}${status.slice(1)} “${label}”`, id);
  }

  return (
    <div className="dashboard">
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{state.identities.length}</span>
          <span className="stat-label">identities</span>
        </div>
        <div className="stat">
          <span className="stat-num">{active}</span>
          <span className="stat-label">active</span>
        </div>
        <div className="stat">
          <span className="stat-num">{state.identities.filter((i) => i.card).length}</span>
          <span className="stat-label">masked cards</span>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search identities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New identity
        </button>
      </div>

      {identities.length === 0 ? (
        <div className="empty">
          <p>No identities yet.</p>
          <p className="hint">
            Create a masked identity for each service you sign up for — a unique
            email, phone, persona, and password that shields your real details.
          </p>
        </div>
      ) : (
        <div className="identity-grid">
          {identities.map((i) => (
            <button key={i.id} className="identity-card" onClick={() => setSelectedId(i.id)}>
              <div className="identity-card-head">
                <Dot color={i.color} />
                <span className="identity-label">{i.label}</span>
                <StatusBadge status={i.status} />
              </div>
              <div className="identity-alias mono">{i.emailAlias}</div>
              {i.phoneAlias && <div className="identity-alias mono dim">{i.phoneAlias}</div>}
              <div className="identity-persona dim">
                {i.persona.firstName} {i.persona.lastName} · {i.persona.city}, {i.persona.state}
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <CreateIdentity
          count={state.identities.length}
          settings={settings}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      )}
      {selected && (
        <IdentityDetail
          identity={selected}
          server={server}
          onClose={() => setSelectedId(null)}
          onStatus={(status) => handleStatus(selected.id, status)}
          onUpdate={(patch) => onUpdate(selected.id, patch)}
          onRemove={async () => {
            await onRemove(selected.id);
            await log("identity_revoked", `Deleted “${selected.label}”`);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
