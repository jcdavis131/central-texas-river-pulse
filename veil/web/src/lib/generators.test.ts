import { describe, expect, it } from "vitest";
import {
  generateEmailAlias,
  generatePassword,
  generatePhoneAlias,
  generateTestCard,
  isLuhnValid,
  passwordEntropyBits,
  randInt,
} from "./generators";

describe("randInt", () => {
  it("stays within bounds", () => {
    for (let i = 0; i < 500; i++) {
      const n = randInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });
  it("returns 0 for non-positive max", () => {
    expect(randInt(0)).toBe(0);
  });
});

describe("generatePassword", () => {
  it("respects length and includes required classes by default", () => {
    const pw = generatePassword({ length: 24 });
    expect(pw).toHaveLength(24);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(pw)).toBe(true);
  });
  it("clamps to a minimum length", () => {
    expect(generatePassword({ length: 2 }).length).toBeGreaterThanOrEqual(8);
  });
  it("can omit symbols", () => {
    const pw = generatePassword({ length: 30, symbols: false });
    expect(/[^a-zA-Z0-9]/.test(pw)).toBe(false);
  });
});

describe("passwordEntropyBits", () => {
  it("grows with length and character variety", () => {
    expect(passwordEntropyBits("aaaa")).toBeLessThan(passwordEntropyBits("aA1!aA1!"));
  });
  it("is zero for empty", () => {
    expect(passwordEntropyBits("")).toBe(0);
  });
});

describe("generateTestCard", () => {
  it("produces a Luhn-valid 16-digit number", () => {
    for (let i = 0; i < 50; i++) {
      const card = generateTestCard();
      expect(card.number.replace(/\s/g, "")).toHaveLength(16);
      expect(isLuhnValid(card.number)).toBe(true);
    }
  });
  it("has a future expiry", () => {
    const card = generateTestCard();
    expect(card.expYear).toBeGreaterThan(new Date().getFullYear());
  });
});

describe("aliases", () => {
  it("email alias derives a slug from the label and is unique-ish", () => {
    const a = generateEmailAlias("My Service!");
    expect(a.startsWith("myservice.")).toBe(true);
    expect(a.endsWith("@relay.veil.example")).toBe(true);
    expect(generateEmailAlias("x")).not.toBe(generateEmailAlias("x"));
  });
  it("phone alias uses the reserved 555-01xx test range", () => {
    expect(generatePhoneAlias()).toMatch(/^\+1 \(\d{3}\) 555-01\d{2}$/);
  });
});
