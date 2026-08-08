import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totp } from "./totp";

const SEED_B32 = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("client TOTP", () => {
  it("encodes the RFC seed canonically", () => {
    expect(SEED_B32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("round-trips base32", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(new TextDecoder().decode(base32Decode(base32Encode(bytes)))).toBe("hello");
  });

  it("matches RFC 6238 8-digit vectors (SHA1)", async () => {
    const vectors: Array<[number, string]> = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1234567890, "89005924"],
    ];
    for (const [t, code] of vectors) {
      expect(await totp(SEED_B32, { timestamp: t * 1000, digits: 8 })).toBe(code);
    }
  });
});
