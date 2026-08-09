import { useCallback, useEffect, useState } from "react";
import type { ServerApi } from "../hooks/useServer";
import type { InboxMessage } from "../lib/api";

export function Inbox({ server }: { server: ServerApi }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!server.client) return;
    setLoading(true);
    try {
      const r = await server.client.listInbox();
      setMessages(r.messages);
      setUnread(r.unread);
      setError(null);
    } catch {
      setError("Couldn’t load the inbox.");
    } finally {
      setLoading(false);
    }
  }, [server.client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(m: InboxMessage) {
    setSelected(m);
    if (!m.read && server.client) {
      await server.client.markRead(m.id, true).catch(() => undefined);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: 1 } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
  }

  async function remove(m: InboxMessage) {
    if (!server.client) return;
    await server.client.deleteMessage(m.id).catch(() => undefined);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (selected?.id === m.id) setSelected(null);
  }

  if (!server.connected) {
    return (
      <div className="empty">
        <span className="empty-emoji">📥</span>
        <h3>Inbox needs a server</h3>
        <p className="hint">
          Connect a Veil server in Settings. Mail sent to your email aliases is forwarded to your
          real inbox and also shows up here so you can read and reply without exposing your address.
        </p>
      </div>
    );
  }

  return (
    <div className="inbox">
      <div className="inbox-head">
        <h2 className="page-title" style={{ margin: 0 }}>
          Inbox {unread > 0 && <span className="unread-pill">{unread}</span>}
        </h2>
        <button className="btn" onClick={load} disabled={loading}>{loading ? "…" : "↻ Refresh"}</button>
      </div>
      {error && <p className="error">{error}</p>}

      {messages.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">✉️</span>
          <h3>No mail yet</h3>
          <p className="hint">Forwarded messages to your aliases will appear here.</p>
        </div>
      ) : (
        <ul className="msg-list">
          {messages.map((m) => (
            <li
              key={m.id}
              className={"msg-row" + (m.read ? "" : " unread")}
              onClick={() => open(m)}
            >
              <div className="msg-main">
                <span className="msg-from">{m.from_addr}</span>
                <span className="msg-subject">{m.subject}</span>
                <span className="msg-alias mono dim">to {m.alias_address}</span>
              </div>
              <time className="msg-time">{new Date(m.received_at).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <MessageView
          server={server}
          message={selected}
          onClose={() => setSelected(null)}
          onDelete={() => remove(selected)}
        />
      )}
    </div>
  );
}

function MessageView({
  server,
  message,
  onClose,
  onDelete,
}: {
  server: ServerApi;
  message: InboxMessage;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const canReply = server.health?.providers.email ?? false;

  async function send() {
    if (!server.client) return;
    setStatus("Sending…");
    try {
      await server.client.replyMessage(message.id, body);
      setStatus("Reply sent from your alias.");
      setReplying(false);
      setBody("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Reply failed.");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{message.subject}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            From <strong>{message.from_addr}</strong> · to <span className="mono">{message.alias_address}</span> ·{" "}
            {new Date(message.received_at).toLocaleString()}
          </p>
          <pre className="msg-body">{message.body}</pre>

          {replying ? (
            <>
              <textarea
                className="input textarea"
                rows={4}
                placeholder={`Reply to ${message.from_addr} from your alias…`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="modal-actions">
                <button className="btn btn-primary" disabled={!body.trim()} onClick={send}>Send reply</button>
                <button className="btn" onClick={() => setReplying(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setReplying(true)} disabled={!canReply} title={canReply ? "" : "Email provider not configured on the server"}>
                Reply from alias
              </button>
              <div className="spacer" />
              <button className="btn btn-danger-ghost" onClick={onDelete}>Delete</button>
            </div>
          )}
          {!canReply && <p className="hint">Replies need the server’s email provider configured.</p>}
          {status && <p className="hint">{status}</p>}
        </div>
      </div>
    </div>
  );
}
