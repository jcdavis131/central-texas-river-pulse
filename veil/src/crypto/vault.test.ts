import { describe, expect, it } from "vitest";
import { deriveKey, makeVerifier, newKdfParams, open, seal, verify } from "./vault";

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
