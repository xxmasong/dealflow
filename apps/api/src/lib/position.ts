// Fractional sort keys for drag-and-drop ordering.
//
// Each deal stores a base-36 string; sorting those strings lexicographically
// gives the column order. To move a card between two neighbours we generate a
// key that sorts strictly between theirs, so only the moved row is written.
// Generated keys never end in "0", which guarantees there is always room
// below any key.

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

/** Keys for `count` items in order, evenly spaced. Used when seeding. */
export function initialKeys(count: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    prev = keyBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}
