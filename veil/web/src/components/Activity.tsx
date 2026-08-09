import type { ActivityEvent, VaultState } from "../lib/types";

const ICON: Record<ActivityEvent["kind"], string> = {
  identity_created: "✦",
  identity_paused: "⏸",
  identity_resumed: "▶",
  identity_muted: "🔇",
  identity_revoked: "⊘",
  email_forwarded: "✉",
  call_screened: "☎",
  secret_updated: "🔑",
  card_issued: "▭",
  vault_recovered: "🗝",
  password_changed: "🔐",
};

export function Activity({ state }: { state: VaultState }) {
  if (state.activity.length === 0) {
    return (
      <div className="empty">
        <span className="empty-emoji">🍃</span>
        <h3>Nothing here yet</h3>
        <p className="hint">Actions you take — creating, pausing, or revoking identities — will show up here.</p>
      </div>
    );
  }
  return (
    <div className="activity">
      <ul className="activity-list">
        {state.activity.map((e) => (
          <li key={e.id} className="activity-item">
            <span className="activity-icon" aria-hidden>
              {ICON[e.kind] ?? "•"}
            </span>
            <span className="activity-detail">{e.detail}</span>
            <time className="activity-time" dateTime={e.at}>
              {new Date(e.at).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
