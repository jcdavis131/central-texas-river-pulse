import { useMemo, useState } from "react";
import type { VaultState } from "../lib/types";
import type { ServerApi } from "../hooks/useServer";
import { passwordEntropyBits } from "../lib/generators";

const WEAK_BITS = 50;

export function Security({ state, server }: { state: VaultState; server: ServerApi }) {
  const withSecret = state.identities.filter((i) => i.secret?.password);

  const analysis = useMemo(() => {
    const counts = new Map<string, string[]>(); // password -> identity labels
    for (const i of withSecret) {
      const pw = i.secret!.password;
      counts.set(pw, [...(counts.get(pw) ?? []), i.label]);
    }
    const reused = withSecret.filter((i) => (counts.get(i.secret!.password)?.length ?? 0) > 1);
    const weak = withSecret.filter((i) => passwordEntropyBits(i.secret!.password) < WEAK_BITS);
    const noTotp = withSecret.filter((i) => !i.secret!.totpSecret);
    return { reused, weak, noTotp };
  }, [withSecret]);

  const [breached, setBreached] = useState<string[] | null>(null);
  const [scanning, setScanning] = useState(false);

  async function scanBreaches() {
    if (!server.connected) return;
    setScanning(true);
    try {
      const unique = Array.from(new Set(withSecret.map((i) => i.secret!.password)));
      const bad = new Set<string>();
      for (const pw of unique) {
        try {
          const r = await server.checkBreach(pw);
          if (r.breached) bad.add(pw);
        } catch {
          /* skip on error */
        }
      }
      setBreached(withSecret.filter((i) => bad.has(i.secret!.password)).map((i) => i.label));
    } finally {
      setScanning(false);
    }
  }

  const total = withSecret.length;
  const issues = analysis.reused.length + analysis.weak.length + (breached?.length ?? 0);
  const score = total === 0 ? 100 : Math.max(0, Math.round(100 - (issues / total) * 100));
  const grade = score >= 85 ? "good" : score >= 60 ? "fair" : "poor";

  if (total === 0) {
    return (
      <div className="empty">
        <span className="empty-emoji">🛡️</span>
        <h3>Nothing to check yet</h3>
        <p className="hint">Once your identities have passwords, this page scores their health.</p>
      </div>
    );
  }

  return (
    <div className="security">
      <div className={`score-card score-${grade}`}>
        <div className="score-ring" style={{ ["--pct" as any]: score }}>
          <span className="score-num">{score}</span>
          <span className="score-max">/100</span>
        </div>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Security score</h2>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            {grade === "good"
              ? "Looking strong. Keep it up."
              : grade === "fair"
                ? "A few things worth tightening."
                : "Several passwords need attention."}
          </p>
        </div>
      </div>

      <div className="health-grid">
        <HealthCard title="Reused passwords" items={analysis.reused.map((i) => i.label)} okText="No reuse — every login is unique." tone="danger" />
        <HealthCard title="Weak passwords" items={analysis.weak.map((i) => i.label)} okText="All passwords are strong." tone="warn" />
        <HealthCard title="Missing 2FA" items={analysis.noTotp.map((i) => i.label)} okText="Every login has a TOTP secret." tone="muted" />
        <div className="health-card">
          <div className="health-head">
            <span className="health-title">Breach exposure</span>
          </div>
          {!server.connected ? (
            <p className="hint">Connect a server in Settings to scan passwords against known breaches.</p>
          ) : breached === null ? (
            <button className="btn" disabled={scanning} onClick={scanBreaches}>
              {scanning ? "Scanning…" : "Scan for breaches"}
            </button>
          ) : breached.length === 0 ? (
            <p className="breach-ok">✓ None of your passwords appear in known breaches.</p>
          ) : (
            <>
              <p className="breach-bad">⚠ {breached.length} exposed — rotate these:</p>
              <ul className="health-items">{breached.map((l) => <li key={l}>{l}</li>)}</ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  title,
  items,
  okText,
  tone,
}: {
  title: string;
  items: string[];
  okText: string;
  tone: "danger" | "warn" | "muted";
}) {
  return (
    <div className="health-card">
      <div className="health-head">
        <span className="health-title">{title}</span>
        <span className={`health-count health-${items.length ? tone : "ok"}`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="breach-ok">✓ {okText}</p>
      ) : (
        <ul className="health-items">{items.map((l) => <li key={l}>{l}</li>)}</ul>
      )}
    </div>
  );
}
