import { createHash } from "node:crypto";

/**
 * Breach monitoring via the HaveIBeenPwned "Pwned Passwords" range API using
 * k-anonymity: only the first 5 chars of the SHA-1 hash are sent, so the actual
 * password (and its full hash) never leaves this server.
 *
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range/";

export interface BreachResult {
  breached: boolean;
  /** How many times the password appeared in known breach corpora. */
  count: number;
}

/** Split a SHA-1 into the 5-char prefix (sent) and 35-char suffix (matched locally). */
export function sha1Parts(password: string): { prefix: string; suffix: string } {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

/** Parse a HIBP range response body and find the count for a given suffix. */
export function parseRange(body: string, suffix: string): number {
  const target = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    if (line.slice(0, sep).toUpperCase() === target) {
      return Number(line.slice(sep + 1)) || 0;
    }
  }
  return 0;
}

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function checkPassword(
  password: string,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<BreachResult> {
  const { prefix, suffix } = sha1Parts(password);
  const res = await fetcher(RANGE_ENDPOINT + prefix);
  if (!res.ok) throw new Error(`HIBP request failed: ${res.status}`);
  const count = parseRange(await res.text(), suffix);
  return { breached: count > 0, count };
}
