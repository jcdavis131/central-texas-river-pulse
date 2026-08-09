import { describe, expect, it } from "vitest";
import {
  deriveKey,
  exportVek,
  importVek,
  makeVerifier,
  newKdfParams,
  newRecoveryKey,
  newVek,
  normalizeRecoveryKey,
  open,
  seal,
  unwrapVek,
  verify,
  wrapVek,
} from "./vault";

describe("vault crypto", () => {
  it("round-trips plaintext through seal/open", async () => {
    const key = await deriveKey("correct horse battery staple", newKdfParams());
    const sealed = await seal(key, "top secret");
    expect(sealed.data).not.toContain("top secret");
    expect(await open(key, sealed)).toBe("top secret");
  });

  it("fails to open with the wrong key", async () => {
    const params = newKdfParams();
    const key = await deriveKey("password-a", params);
    const wrong = await deriveKey("password-b", params);
    const sealed = await seal(key, "payload");
    await expect(open(wrong, sealed)).rejects.toBeTruthy();
  });

  it("verifier only matches the correct password", async () => {
    const params = newKdfParams();
    const key = await deriveKey("hunter2", params);
    const verifier = await makeVerifier(key);
    expect(await verify(key, verifier)).toBe(true);

    const wrong = await deriveKey("hunter3", params);
    expect(await verify(wrong, verifier)).toBe(false);
  });

  it("uses a fresh IV per seal", async () => {
    const key = await deriveKey("pw", newKdfParams());
    const a = await seal(key, "same");
    const b = await seal(key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });
});

describe("envelope encryption (VEK wrapping)", () => {
  it("wraps and unwraps a VEK with a password-derived KEK", async () => {
    const vek = newVek();
    const kek = await deriveKey("master-pw", newKdfParams());
    const wrapped = await wrapVek(kek, vek);
    const unwrapped = await unwrapVek(kek, wrapped);
    expect([...unwrapped]).toEqual([...vek]);
  });

  it("wrong KEK cannot unwrap the VEK", async () => {
    const vek = newVek();
    const params = newKdfParams();
    const kek = await deriveKey("right", params);
    const bad = await deriveKey("wrong", params);
    const wrapped = await wrapVek(kek, vek);
    await expect(unwrapVek(bad, wrapped)).rejects.toBeTruthy();
  });

  it("VEK survives export/import round-trip (used by changePassword)", async () => {
    const vek = newVek();
    const key = await importVek(vek);
    const roundtripped = await exportVek(key);
    expect([...roundtripped]).toEqual([...vek]);
  });

  it("data sealed by the imported VEK opens after re-import", async () => {
    const vek = newVek();
    const k1 = await importVek(vek);
    const sealed = await seal(k1, "vault-json");
    const k2 = await importVek(vek);
    expect(await open(k2, sealed)).toBe("vault-json");
  });

  it("a VEK can be recovered via a second (recovery) KEK", async () => {
    const vek = newVek();
    const kekPw = await deriveKey("pw", newKdfParams());
    const kekRec = await deriveKey("RECOVERYSECRET", newKdfParams());
    const wrapPw = await wrapVek(kekPw, vek);
    const wrapRec = await wrapVek(kekRec, vek);
    // Both wraps unwrap to the same VEK.
    expect([...(await unwrapVek(kekPw, wrapPw))]).toEqual([...vek]);
    expect([...(await unwrapVek(kekRec, wrapRec))]).toEqual([...vek]);
  });
});

describe("recovery key", () => {
  it("produces a 256-bit dash-grouped base32 string", () => {
    const rk = newRecoveryKey();
    expect(rk).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4})+$/);
    // 256 bits -> 52 base32 chars -> 13 groups of 4.
    expect(normalizeRecoveryKey(rk)).toHaveLength(52);
  });

  it("normalizes spaces, dashes and case", () => {
    expect(normalizeRecoveryKey("abcd-efgh ijkl")).toBe("ABCDEFGHIJKL");
  });

  it("generates distinct keys", () => {
    expect(newRecoveryKey()).not.toBe(newRecoveryKey());
  });
});
