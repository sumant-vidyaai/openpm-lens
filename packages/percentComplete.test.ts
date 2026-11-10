import { describe, expect, it } from 'vitest';
import { percentComplete, storyPointPercent } from '../src/percentComplete';

describe('percentComplete rules', () => {
  it('tool_reported uses the reported number', () => {
    const r = percentComplete('tool_reported', { reportedPercent: 30, statusCategory: 'in_progress' });
    expect(r.value).toBe(30);
  });

  it('tool_reported names the missing field when absent', () => {
    const r = percentComplete('tool_reported', { reportedPercent: null, statusCategory: 'done' });
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(['percentCompleteReported']);
  });

  it('tool_reported rejects out-of-range values instead of clamping them', () => {
    const r = percentComplete('tool_reported', { reportedPercent: 140, statusCategory: 'done' });
    expect(r.value).toBeNull();
    expect(r.issues[0]).toContain('outside 0-100');
  });

  it('zero_hundred', () => {
    const input = (s: 'not_started' | 'in_progress' | 'done') => ({ reportedPercent: null, statusCategory: s });
    expect(percentComplete('zero_hundred', input('not_started')).value).toBe(0);
    expect(percentComplete('zero_hundred', input('in_progress')).value).toBe(0);
    expect(percentComplete('zero_hundred', input('done')).value).toBe(100);
  });

  it('fifty_fifty', () => {
    const input = (s: 'not_started' | 'in_progress' | 'done') => ({ reportedPercent: null, statusCategory: s });
    expect(percentComplete('fifty_fifty', input('not_started')).value).toBe(0);
    expect(percentComplete('fifty_fifty', input('in_progress')).value).toBe(50);
    expect(percentComplete('fifty_fifty', input('done')).value).toBe(100);
  });

  it('status_based needs an explicit in-progress percentage', () => {
    const input = { reportedPercent: null, statusCategory: 'in_progress' as const };
    expect(() => percentComplete('status_based', input)).toThrow(RangeError);
    expect(percentComplete('status_based', input, { inProgressPercent: 25 }).value).toBe(25);
  });

  it('missing status is reported, not defaulted', () => {
    const r = percentComplete('zero_hundred', { reportedPercent: null, statusCategory: null });
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(['statusCategory']);
  });

  it('cancelled items are excluded with an explanation', () => {
    const r = percentComplete('fifty_fifty', { reportedPercent: null, statusCategory: 'cancelled' });
    expect(r.value).toBeNull();
    expect(r.issues[0]).toContain('cancelled');
  });

  it('every result carries the assumption text for on-screen display', () => {
    const r = percentComplete('zero_hundred', { reportedPercent: null, statusCategory: 'done' });
    expect(r.assumption).toContain('0/100');
  });
});

describe('storyPointPercent', () => {
  it('computes completed / total', () => {
    expect(storyPointPercent(30, 120)).toBe(25);
  });
  it('returns null for missing or impossible totals', () => {
    expect(storyPointPercent(5, 0)).toBeNull();
    expect(storyPointPercent(10, 5)).toBeNull();
    expect(storyPointPercent(Number.NaN, 5)).toBeNull();
  });
});

describe('cancelled items under the tool-reported rule', () => {
  it('are excluded even when the file gives a percent', () => {
    const r = percentComplete('tool_reported', { reportedPercent: 40, statusCategory: 'cancelled' });
    expect(r.value).toBeNull();
    expect(r.issues[0]).toMatch(/cancelled/);
  });
  it('a reported percent without a status is still used', () => {
    expect(percentComplete('tool_reported', { reportedPercent: 40, statusCategory: null }).value).toBe(40);
  });
});
