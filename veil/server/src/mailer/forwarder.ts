import { SMTPServer, type SMTPServerOptions } from "smtp-server";
import type { Db } from "../db.js";
import type { EmailForwarder } from "../providers/types.js";

/** Extract the Subject header from a raw RFC822 message (best-effort). */
export function parseSubject(raw: string): string {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerBlock = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
  // Unfold folded headers, then match Subject:
  const unfolded = headerBlock.replace(/\r\n[ \t]+/g, " ");
  const m = unfolded.match(/^Subject:\s*(.*)$/im);
  return m ? m[1].trim() : "(no subject)";
}

export interface ForwardOutcome {
  alias: string;
  delivered: boolean;
  reason?: string;
}

/**
 * Core routing decision, separated from the SMTP transport so it is unit-testable.
 * For each recipient alias, resolve it and forward to its destination unless it
 * is paused/revoked or unknown.
 */
export async function routeMessage(
  db: Db,
  forwarder: EmailForwarder,
  msg: { from: string; recipients: string[]; raw: string },
  onActivity?: (userId: string, detail: string) => void,
): Promise<ForwardOutcome[]> {
  const subject = parseSubject(msg.raw);
  const outcomes: ForwardOutcome[] = [];
  for (const rcpt of msg.recipients) {
    const address = rcpt.toLowerCase();
    const alias = db.getAliasByAddress(address);
    if (!alias || alias.kind !== "email") {
      outcomes.push({ alias: address, delivered: false, reason: "unknown alias" });
      continue;
    }
    if (alias.status !== "active") {
      outcomes.push({ alias: address, delivered: false, reason: `alias ${alias.status}` });
      continue;
    }
    await forwarder.forward({
      from: msg.from,
      to: address,
      destination: alias.destination,
      subject,
      raw: msg.raw,
    });
    onActivity?.(alias.user_id, `Forwarded "${subject}" from ${msg.from} via ${address}`);
    outcomes.push({ alias: address, delivered: true });
  }
  return outcomes;
}

function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export function createSmtpServer(
  db: Db,
  forwarder: EmailForwarder,
  aliasDomain: string,
  onActivity?: (userId: string, detail: string) => void,
): SMTPServer {
  const options: SMTPServerOptions = {
    authOptional: true,
    disabledCommands: ["AUTH"],
    onRcptTo(address, _session, callback) {
      // Only accept mail addressed to our alias domain.
      if (!address.address.toLowerCase().endsWith(`@${aliasDomain.toLowerCase()}`)) {
        return callback(new Error("relay denied: not an alias domain"));
      }
      callback();
    },
    onData(stream, session, callback) {
      readStream(stream)
        .then(async (buf) => {
          const from = session.envelope.mailFrom ? session.envelope.mailFrom.address : "unknown";
          const recipients = session.envelope.rcptTo.map((r) => r.address);
          await routeMessage(db, forwarder, { from, recipients, raw: buf.toString("utf8") }, onActivity);
          callback();
        })
        .catch((err) => callback(err as Error));
    },
  };
  return new SMTPServer(options);
}
