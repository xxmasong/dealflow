import { describe, expect, it } from 'vitest';
import { keyFromLabel, parseFieldValue } from './fields.js';

const field = (type: 'text' | 'number' | 'date' | 'select' | 'metric', options: string[] = []) => ({
  type,
  label: 'Field',
  options,
});

describe('parseFieldValue', () => {
  it('treats empty input as a cleared value', () => {
    expect(parseFieldValue(field('text'), '')).toBeNull();
    expect(parseFieldValue(field('number'), null)).toBeNull();
  });

  it('trims text', () => {
    expect(parseFieldValue(field('text'), '  hello ')).toBe('hello');
  });

  it('accepts numbers and numeric strings for number and metric fields', () => {
    expect(parseFieldValue(field('number'), 12.5)).toBe(12.5);
    expect(parseFieldValue(field('metric'), '40')).toBe(40);
    expect(() => parseFieldValue(field('number'), 'abc')).toThrow(/expected a number/);
  });

  it('validates dates', () => {
    expect(parseFieldValue(field('date'), '2026-03-01')).toBe('2026-03-01');
    expect(() => parseFieldValue(field('date'), '03/01/2026')).toThrow(/YYYY-MM-DD/);
  });

  it('only accepts configured select options', () => {
    const f = field('select', ['Seed', 'Series A']);
    expect(parseFieldValue(f, 'Seed')).toBe('Seed');
    expect(() => parseFieldValue(f, 'Series Z')).toThrow(/must be one of/);
  });
});

describe('keyFromLabel', () => {
  it('builds snake_case keys', () => {
    expect(keyFromLabel('ARR Growth %')).toBe('arr_growth');
    expect(keyFromLabel('  Lead source ')).toBe('lead_source');
  });

  it('rejects labels with no usable characters', () => {
    expect(() => keyFromLabel('%%%')).toThrow();
  });
});
