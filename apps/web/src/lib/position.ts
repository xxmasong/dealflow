// Same algorithm as apps/api/src/lib/position.ts, used for optimistic moves so a
// dropped card lands where the server will put it before the response arrives.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

function digitAt(key: string, i: number): number {
  const ch = key[i];
  if (ch === undefined) return 0;
  const d = DIGITS.indexOf(ch);
  if (d < 0) throw new Error(`Invalid position key: ${key}`);
  return d;
}

/**
 * Returns a key that sorts after `before` and before `after`.
 * Pass `null` for an open end (start or end of the list).
 */
export function keyBetween(before: string | null, after: string | null): string {
  const a = before ?? '';
  let b = after;
  if (b !== null && a >= b) {
    throw new Error(`keyBetween: "${a}" must sort before "${b}"`);
  }

  let result = '';
  for (let i = 0; ; i++) {
    const da = digitAt(a, i);
    const db = b === null ? BASE : i < b.length ? digitAt(b, i) : 0;

    if (da === db) {
      result += DIGITS[da];
      continue;
    }
    if (db - da > 1) {
      return result + DIGITS[Math.floor((da + db) / 2)];
    }
    // Adjacent digits: keep a's digit and look for room further right, where
    // the upper bound no longer applies.
    result += DIGITS[da];
    b = null;
  }
}
