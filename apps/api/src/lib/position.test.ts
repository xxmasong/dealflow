import { describe, expect, it } from 'vitest';
import { initialKeys, keyBetween } from './position.js';

describe('keyBetween', () => {
  it('creates a first key', () => {
    expect(keyBetween(null, null)).toBe('i');
  });

  it('sorts strictly between its neighbours', () => {
    const cases: Array<[string | null, string | null]> = [
      [null, 'i'],
      ['i', null],
      ['a', 'b'],
      ['az', 'b'],
      ['zz', null],
      [null, '01'],
      ['0i', '0j'],
    ];
    for (const [a, b] of cases) {
      const k = keyBetween(a, b);
      if (a !== null) expect(k > a).toBe(true);
      if (b !== null) expect(k < b).toBe(true);
      expect(k.endsWith('0')).toBe(false);
    }
  });

  it('rejects bounds in the wrong order', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
    expect(() => keyBetween('a', 'a')).toThrow();
  });

  it('keeps a list ordered under many random inserts', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const list: string[] = [];
    for (let n = 0; n < 2000; n++) {
      const at = Math.floor(rand() * (list.length + 1));
      const key = keyBetween(list[at - 1] ?? null, list[at] ?? null);
      list.splice(at, 0, key);
    }
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('initialKeys', () => {
  it('returns increasing keys', () => {
    const keys = initialKeys(50);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(50);
  });
});
