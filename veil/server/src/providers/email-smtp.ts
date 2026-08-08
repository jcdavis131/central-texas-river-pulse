import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProviderConfig } from "../config.js";
import type { EmailForwarder } from "./types.js";

/**
 * Forwards received mail to the user's real inbox over an outbound SMTP relay.
 * When disabled (no relay configured) it logs the forward decision instead, so
 * the routing pipeline is exercisable without external credentials.
 */
export class SmtpForwarder implements EmailForwarder {
  readonly kind = "email" as const;
  readonly live: boolean;
  private transporter: Transporter | null = null;
  private from: string;

  constructor(cfg: EmailProviderConfig, transporter?: Transporter) {
    this.live = cfg.enabled || Boolean(transporter);
    this.from = cfg.fromAddress;
    if (transporter) {
      this.transporter = transporter;
      return;
    }
    if (cfg.enabled) {
      this.transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpSecure,
        auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
      });
    }
  }

  async forward(msg: {
    from: string;
    to: string;
    destination: string;
    subject: string;
    raw: Buffer | string;
  }): Promise<void> {
    if (!this.transporter) {
      // Dormant mode: no relay configured. The routing decision still happened.
      console.log(
        `[email] would forward "${msg.subject}" (${msg.from} -> alias ${msg.to}) to ${msg.destination}`,
      );
      return;
    }
    const body = Buffer.isBuffer(msg.raw) ? msg.raw.toString("utf8") : msg.raw;
    await this.transporter.sendMail({
      // Mail appears from the alias domain; Reply-To routes replies to the sender.
      from: this.from,
      to: msg.destination,
      replyTo: msg.from,
      subject: msg.subject,
      text: body,
      headers: {
        "X-Veil-Alias": msg.to,
        "X-Veil-Original-From": msg.from,
      },
    });
  }
}
