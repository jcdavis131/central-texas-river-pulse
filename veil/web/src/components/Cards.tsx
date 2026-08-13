import { useCallback, useEffect, useState } from "react";
import type { ServerApi } from "../hooks/useServer";
import type { CardRecord } from "../lib/api";
import { CopyButton } from "./ui";

export function Cards({ server }: { server: ServerApi }) {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [justIssued, setJustIssued] = useState<{ number: string; cvc: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const live = server.health?.providers.card ?? false;

  const load = useCallback(async () => {
    if (!server.client) return;
    setLoading(true);
    try {
      setCards((await server.client.listCards()).cards);
    } finally {
      setLoading(false);
    }
  }, [server.client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issue() {
    if (!server.client) return;
    setBusy(true);
    setError(null);
    setJustIssued(null);
    try {
      const r = await server.client.issueCard({
        label: label.trim() || "Card",
        monthlyLimit: limit ? Number(limit) : undefined,
      });
      setJustIssued(r.secret);
      setLabel("");
      setLimit("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not issue card.");
    } finally {
      setBusy(false);
    }
  }

  async function freeze(c: CardRecord) {
    if (!server.client) return;
    await server.client.freezeCard(c.id).catch(() => undefined);
    setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "frozen" } : x)));
  }

  if (!server.connected) {
    return (
      <div className="empty">
        <span className="empty-emoji">💳</span>
        <h3>Cards need a server</h3>
        <p className="hint">
          Connect a Veil server in Settings. With a Stripe Issuing key configured, cards here are
          real virtual cards with spend limits; without one, they’re Luhn-valid test tokens you
          can’t charge.
        </p>
      </div>
    );
  }

  return (
    <div className="cards-page">
      <h2 className="page-title">Masked cards</h2>
      <p className="page-sub">
        {live ? "Real virtual cards via Stripe Issuing." : "Test tokens (Luhn-valid, non-chargeable) — add a Stripe key on the server to issue real cards."}
      </p>

      <div className="card-issue">
        <input className="input" placeholder="Label (e.g. Streaming)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input" type="number" min="0" placeholder="Monthly limit ($, optional)" value={limit} onChange={(e) => setLimit(e.target.value)} />
        <button className="btn btn-primary" disabled={busy} onClick={issue}>{busy ? "Issuing…" : "Issue card"}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {justIssued && (
        <div className="card-secret">
          <span className="tag-test">shown once</span>
          <span className="mono">{justIssued.number}</span>
          <span className="mono dim">CVC {justIssued.cvc}</span>
          <CopyButton value={justIssued.number.replace(/\s/g, "")} label="card number" />
        </div>
      )}

      {loading ? (
        <p className="hint">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          <span className="empty-emoji">💳</span>
          <h3>No cards yet</h3>
          <p className="hint">Issue your first masked card above.</p>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((c) => (
            <div key={c.id} className={"vcard" + (c.status === "frozen" ? " frozen" : "")}>
              <div className="vcard-top">
                <span className="vcard-label">{c.label}</span>
                <span className={"badge " + (c.status === "frozen" ? "badge-paused" : "badge-active")}>{c.status}</span>
              </div>
              <div className="vcard-num mono">•••• •••• •••• {c.last4}</div>
              <div className="vcard-foot">
                <span className="mono dim">{String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}</span>
                <span className="dim">{c.brand}</span>
                {c.monthly_limit != null && <span className="dim">${c.monthly_limit}/mo</span>}
              </div>
              {c.status !== "frozen" && (
                <button className="btn btn-warn vcard-freeze" onClick={() => freeze(c)}>Freeze</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
