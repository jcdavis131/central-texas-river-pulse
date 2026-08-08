import { describe, expect, it, beforeEach } from "vitest";
import { Db } from "../db.js";
import { parseSubject, routeMessage } from "./forwarder.js";
import type { EmailForwarder } from "../providers/types.js";

function capturingForwarder() {
  const calls: Array<{ from: string; to: string; destination: string; subject: string }> = [];
  const fwd: EmailForwarder = {
    kind: "email",
    live: true,
    async forward(msg) {
      calls.push({ from: msg.from, to: msg.to, destination: msg.destination, subject: msg.subject });
    },
  };
  return { fwd, calls };
}

function seedUserWithAlias(db: Db, address: string, status: "active" | "paused" = "active") {
  db.createUser({ id: "u1", email: "real@me.com", pw_hash: "x", pw_salt: "y", created_at: "t" });
  db.createAlias({
    id: "a1",
    user_id: "u1",
    address: address.toLowerCase(),
    destination: "real@me.com",
    kind: "email",
    label: "Test",
    status,
    created_at: "t",
  });
}

describe("parseSubject", () => {
  it("reads the Subject header", () => {
    const raw = "From: a@b.com\r\nSubject: Hello there\r\nTo: x@y.com\r\n\r\nbody";
    expect(parseSubject(raw)).toBe("Hello there");
  });
  it("unfolds folded subject lines", () => {
    const raw = "Subject: Hello\r\n there\r\n\r\nbody";
    expect(parseSubject(raw)).toBe("Hello there");
  });
  it("falls back when absent", () => {
    expect(parseSubject("From: a@b.com\r\n\r\nbody")).toBe("(no subject)");
  });
});

describe("routeMessage", () => {
  let db: Db;
  beforeEach(() => {
    db = new Db(":memory:");
  });

  it("forwards mail for an active alias to its destination", async () => {
    seedUserWithAlias(db, "shop.ab12@relay.veil.example");
    const { fwd, calls } = capturingForwarder();
    const raw = "Subject: Order #5\r\n\r\nthanks";
    const outcomes = await routeMessage(db, fwd, {
      from: "store@shop.com",
      recipients: ["shop.ab12@relay.veil.example"],
      raw,
    });
    expect(outcomes[0].delivered).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].destination).toBe("real@me.com");
    expect(calls[0].subject).toBe("Order #5");
  });

  it("does not forward for a paused alias", async () => {
    seedUserWithAlias(db, "paused.cd34@relay.veil.example", "paused");
    const { fwd, calls } = capturingForwarder();
    const outcomes = await routeMessage(db, fwd, {
      from: "x@y.com",
      recipients: ["paused.cd34@relay.veil.example"],
      raw: "Subject: hi\r\n\r\nx",
    });
    expect(outcomes[0].delivered).toBe(false);
    expect(outcomes[0].reason).toContain("paused");
    expect(calls).toHaveLength(0);
  });

  it("rejects unknown aliases", async () => {
    const { fwd, calls } = capturingForwarder();
    const outcomes = await routeMessage(db, fwd, {
      from: "x@y.com",
      recipients: ["nobody@relay.veil.example"],
      raw: "Subject: hi\r\n\r\nx",
    });
    expect(outcomes[0].delivered).toBe(false);
    expect(outcomes[0].reason).toBe("unknown alias");
    expect(calls).toHaveLength(0);
  });
});
