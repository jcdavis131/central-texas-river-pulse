import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, totp, totpVerify } from "./totp.js";

// RFC 4226 / RFC 6238 use the ASCII seed "12345678901234567890".
const SEED_ASCII = "12345678901234567890";
const SEED_B32 = base32Encode(Buffer.from(SEED_ASCII));

describe("base32", () => {
  it("round-trips", () => {
    const buf = Buffer.from("hello world");
    expect(base32Decode(base32Encode(buf)).toString()).toBe("hello world");
  });
  it("encodes the RFC seed to the canonical value", () => {
    expect(SEED_B32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
});

describe("HOTP (RFC 4226 test vectors)", () => {
  const expected = [
    "755224", "287082", "359152", "969429", "338314",
    "254676", "287922", "162583", "399871", "520489",
  ];
  it("matches all 10 counters", () => {
    const secret = base32Decode(SEED_B32);
    expected.forEach((code, counter) => {
      expect(hotp(secret, counter, 6, "SHA1")).toBe(code);
    });
  });
});

describe("TOTP (RFC 6238 test vectors, SHA1, 8 digits)", () => {
  const vectors: Array<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  it("matches published vectors", () => {
    for (const [t, code] of vectors) {
      expect(totp(SEED_B32, { timestamp: t * 1000, digits: 8, algorithm: "SHA1" })).toBe(code);
    }
  });
});

describe("totpVerify", () => {
  it("accepts the current code and rejects a wrong one", () => {
    const ts = 1234567890 * 1000;
    const code = totp(SEED_B32, { timestamp: ts });
    expect(totpVerify(SEED_B32, code, { timestamp: ts })).toBe(true);
    expect(totpVerify(SEED_B32, "000000", { timestamp: ts })).toBe(false);
  });
  it("tolerates one step of clock drift", () => {
    const ts = 1234567890 * 1000;
    const prev = totp(SEED_B32, { timestamp: ts - 30_000 });
    expect(totpVerify(SEED_B32, prev, { timestamp: ts, window: 1 })).toBe(true);
    expect(totpVerify(SEED_B32, prev, { timestamp: ts, window: 0 })).toBe(false);
  });
});
