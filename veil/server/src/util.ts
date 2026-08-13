import { randomBytes, randomInt } from "node:crypto";

export function randomId(): string {
  return randomBytes(12).toString("hex");
}

export function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "mask";
}

export function emailAlias(label: string, domain: string): string {
  const tag = randomBytes(2).toString("hex");
  return `${slug(label)}.${tag}@${domain}`;
}

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%^&*-_=+?";

export function generatePassword(length = 20): string {
  const pools = [LOWER, UPPER, DIGIT, SYMBOL];
  const chars = pools.map((p) => p[randomInt(p.length)]);
  const all = pools.join("");
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function nowIso(): string {
  return new Date().toISOString();
}
