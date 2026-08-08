import { describe, expect, it } from "vitest";
import { checkPassword, parseRange, sha1Parts } from "./breach.js";

describe("sha1Parts", () => {
  it("splits the SHA-1 of 'password' into HIBP k-anonymity parts", () => {
    // SHA1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const { prefix, suffix } = sha1Parts("password");
    expect(prefix).toBe("5BAA6");
    expect(suffix).toBe("1E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });
});

describe("parseRange", () => {
  const body = [
    "1E4C9B93F3F0682250B6CF8331B7EE68FD8:99999",
    "0018A45C4D1DEF81644B54AB7F969B88D65:1",
    "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2",
  ].join("\r\n");

  it("finds the count for a matching suffix", () => {
    expect(parseRange(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(99999);
  });
  it("returns 0 when the suffix is absent", () => {
    expect(parseRange(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
  });
});

describe("checkPassword (with injected fetcher)", () => {
  const fakeFetch = (body: string) =>
    async (_url: string) => ({ ok: true, status: 200, text: async () => body });

  it("reports a breach when the suffix is present", async () => {
    const body = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:42";
    const res = await checkPassword("password", fakeFetch(body));
    expect(res).toEqual({ breached: true, count: 42 });
  });

  it("reports safe when the suffix is absent", async () => {
    const res = await checkPassword("password", fakeFetch("ABC:1"));
    expect(res).toEqual({ breached: false, count: 0 });
  });

  it("throws on a non-ok response", async () => {
    const failing = async (_url: string) => ({ ok: false, status: 503, text: async () => "" });
    await expect(checkPassword("x", failing)).rejects.toThrow(/503/);
  });
});
