import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { Db } from "./db.js";
import { buildProviders } from "./providers/index.js";
import { createApp } from "./app.js";
import { createSmtpServer } from "./mailer/forwarder.js";
import { nowIso, randomId } from "./util.js";

// node:sqlite is experimental; silence the startup warning for a clean log.
process.removeAllListeners("warning");

const config = loadConfig();
const db = new Db(config.dbPath);
const providers = buildProviders(config);
const app = createApp({ db, providers, config });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`veil-server: HTTP API on http://localhost:${info.port}`);
  console.log(
    `veil-server: providers — email:${providers.email.live ? "live" : "dormant"} ` +
      `phone:${providers.phone.live ? "live" : "dormant"} card:${providers.card.live ? "live" : "dormant"}`,
  );
});

let smtp: ReturnType<typeof createSmtpServer> | null = null;
if (config.smtpInbound.enabled) {
  smtp = createSmtpServer(db, providers.email, config.aliasDomain, (userId, detail) =>
    db.addActivity({ id: randomId(), user_id: userId, at: nowIso(), kind: "email_forwarded", detail }),
  );
  smtp.listen(config.smtpInbound.port, config.smtpInbound.host, () => {
    console.log(
      `veil-server: inbound SMTP on ${config.smtpInbound.host}:${config.smtpInbound.port} ` +
        `for @${config.aliasDomain}`,
    );
  });
}

function shutdown() {
  console.log("veil-server: shutting down");
  server.close();
  smtp?.close(() => undefined);
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
