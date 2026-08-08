import { describe, expect, it } from "vitest";
import { hashPassword, isExpired, isValidEmail, verifyPassword } from "./auth.js";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const { hash, salt } = await hashPassword("s3cret-passw0rd");
    expect(await verifyPassword("s3cret-passw0rd", hash, salt)).toBe(true);
    expect(await verifyPassword("wrong", hash, salt)).toBe(false);
  });
  it("uses a unique salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("helpers", () => {
  it("validates emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
  it("detects expiry", () => {
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isExpired(new Date(Date.now() + 10000).toISOString())).toBe(false);
  });
});
