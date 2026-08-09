import { useMemo, useState } from "react";
import { Dot, StatusBadge } from "./ui";
import { CreateIdentity } from "./CreateIdentity";
import { IdentityDetail } from "./IdentityDetail";
import type { Identity, Settings, VaultState, ActivityKind } from "../lib/types";
import type { ServerApi } from "../hooks/useServer";

type Sort = "recent" | "name" | "status";

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
  const [sort, setSort] = useState<Sort>("recent");
  const [tag, setTag] = useState<string | null>(null);

  const settings: Settings = state.settings;
  const active = state.identities.filter((i) => i.status === "active").length;
  const selected = state.identities.find((i) => i.id === selectedId) ?? null;

  const allTags = useMemo(() => {
    const s = new Set<string>();
    state.identities.forEach((i) => (i.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [state.identities]);

  const shown = useMemo(() => {
    const q = query.toLowerCase();
    const matches = (i: Identity) =>
      (!tag || (i.tags ?? []).includes(tag)) &&
      (!q ||
        i.label.toLowerCase().includes(q) ||
        i.emailAlias.toLowerCase().includes(q) ||
        (i.url ?? "").toLowerCase().includes(q) ||
        (i.tags ?? []).some((t) => t.includes(q)) ||
        `${i.persona.firstName} ${i.persona.lastName}`.toLowerCase().includes(q));

    const list = state.identities.filter(matches);
    const cmp: Record<Sort, (a: Identity, b: Identity) => number> = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      name: (a, b) => a.label.localeCompare(b.label),
      status: (a, b) => a.status.localeCompare(b.status),
    };
    // Favorites always pinned to the top, then the chosen sort.
    return list.sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || cmp[sort](a, b));
  }, [state.identities, query, tag, sort]);

  async function handleCreate(identity: Identity) {
    let toStore = identity;
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
      status === "revoked" ? "identity_revoked" : status === "paused" ? "identity_paused" : "identity_resumed";
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
          placeholder="Search name, alias, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="recent">Newest</option>
          <option value="name">Name A–Z</option>
          <option value="status">Status</option>
        </select>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New identity</button>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter">
          <button className={"chip" + (tag === null ? " on" : "")} onClick={() => setTag(null)}>All</button>
          {allTags.map((t) => (
            <button key={t} className={"chip" + (tag === t ? " on" : "")} onClick={() => setTag(t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {state.identities.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">🕶️</span>
          <h3>No identities yet</h3>
          <p className="hint">
            Create a masked identity for each service you sign up for — a unique email, phone,
            persona, and password that shields your real details.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ marginTop: 16 }}>
            Create your first identity
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">🔍</span>
          <h3>No matches</h3>
          <p className="hint">Nothing matches your search or tag filter.</p>
        </div>
      ) : (
        <div className="identity-grid">
          {shown.map((i) => (
            <button
              key={i.id}
              className="identity-card"
              style={{ ["--card-accent" as any]: i.color }}
              onClick={() => setSelectedId(i.id)}
            >
              <div className="identity-card-head">
                <Dot color={i.color} />
                <span className="identity-label">{i.label}</span>
                {i.favorite && <span className="card-fav" title="Favorite">★</span>}
                <StatusBadge status={i.status} />
              </div>
              <div className="identity-alias mono">{i.emailAlias}</div>
              {i.phoneAlias && <div className="identity-alias mono dim">{i.phoneAlias}</div>}
              <div className="identity-persona dim">
                {i.persona.firstName} {i.persona.lastName} · {i.persona.city}, {i.persona.state}
              </div>
              {i.tags && i.tags.length > 0 && (
                <div className="card-tags">
                  {i.tags.map((t) => <span key={t} className="tag mini">#{t}</span>)}
                </div>
              )}
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
