import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, timeAgo } from './format';

describe('format', () => {
  it('formats money from cents', () => {
    expect(formatMoney(125_000_000)).toBe('$1.25M');
    expect(formatMoney(4_200_00, 'USD', false)).toBe('$4,200');
    expect(formatMoney(100_00, 'EUR')).toBe('€100');
  });

  it('describes relative time', () => {
    const now = Date.parse('2026-05-10T12:00:00Z');
    expect(timeAgo('2026-05-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-05-07T12:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo('2026-05-09T12:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-03-10T12:00:00Z', now, true)).toBe('2mo ago');
  });

  it('formats ratios as percentages', () => {
    expect(formatPercent(0.333)).toBe('33%');
    expect(formatPercent(null)).toBe('–');
  });
});
