import { randomInt } from "node:crypto";

export interface TestCard {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

function luhnCheckDigit(partial: number[]): number {
  let sum = 0;
  const reversed = [...partial].reverse();
  for (let i = 0; i < reversed.length; i++) {
    let d = reversed[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Luhn-valid but NON-FUNCTIONAL test card token. Cannot be charged. */
export function generateTestCard(): TestCard {
  const digits: number[] = [4];
  for (let i = 0; i < 14; i++) digits.push(randomInt(10));
  digits.push(luhnCheckDigit(digits));
  const number = digits.join("").replace(/(.{4})/g, "$1 ").trim();
  const expYear = new Date().getFullYear() + 2 + randomInt(3);
  const expMonth = 1 + randomInt(12);
  const cvc = String(randomInt(1000)).padStart(3, "0");
  return { number, expMonth, expYear, cvc };
}

export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "").split("").map(Number);
  if (digits.length === 0) return false;
  let sum = 0;
  const reversed = digits.reverse();
  for (let i = 0; i < reversed.length; i++) {
    let d = reversed[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
