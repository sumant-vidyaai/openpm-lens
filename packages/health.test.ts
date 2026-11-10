import { describe, expect, it } from 'vitest';
import { assessHealth, bandFor, DEFAULT_THRESHOLDS, validateThresholds } from '../src/health';

const T = DEFAULT_THRESHOLDS;
const base = { ev: 90, ac: 100, costTasks: 10, evSchedule: 100, pv: 100, scheduleTasks: 10 };

describe('bandFor', () => {
  it('uses the limits inclusively', () => {
    expect(bandFor(0.95, T)).toBe('green');
    expect(bandFor(0.9499, T)).toBe('amber');
    expect(bandFor(0.85, T)).toBe('amber');
    expect(bandFor(0.8499, T)).toBe('red');
  });
  it('null is insufficient, never a colour', () => {
    expect(bandFor(null, T)).toBe('insufficient');
    expect(bandFor(Number.NaN, T)).toBe('insufficient');
  });
});

describe('assessHealth', () => {
  it('takes the worst of CPI and SPI', () => {
    const r = assessHealth(base, T); // CPI 0.9 amber, SPI 1 green
    expect(r.cpi).toBeCloseTo(0.9);
    expect(r.spi).toBe(1);
    expect(r.health).toBe('amber');
  });
  it('red beats amber', () => {
    expect(assessHealth({ ...base, evSchedule: 50 }, T).health).toBe('red');
  });
  it('ignores an index with too few tasks and says why', () => {
    const r = assessHealth({ ...base, scheduleTasks: 2, evSchedule: 10 }, T);
    expect(r.spiBand).toBe('insufficient');
    expect(r.health).toBe('amber'); // from CPI only
    expect(r.reasons.join(' ')).toContain('SPI not used');
  });
  it('is insufficient when no index can be used', () => {
    expect(assessHealth({ ...base, costTasks: 3, scheduleTasks: 3 }, T).health).toBe('insufficient');
    expect(assessHealth({ ev: null, ac: null, costTasks: 0, evSchedule: null, pv: null, scheduleTasks: 0 }, T).health).toBe('insufficient');
  });
  it('zero actual cost gives no CPI rather than a colour', () => {
    const r = assessHealth({ ...base, ac: 0, ev: 0 }, T);
    expect(r.cpi).toBeNull();
  });
  it('respects edited thresholds', () => {
    expect(assessHealth(base, { greenMin: 0.9, amberMin: 0.8, minTasks: 5 }).health).toBe('green');
  });
});

describe('validateThresholds', () => {
  it('accepts the defaults', () => expect(validateThresholds(T)).toBeNull());
  it('rejects bad values', () => {
    expect(validateThresholds({ ...T, amberMin: 1 })).toMatch(/cannot be higher/);
    expect(validateThresholds({ ...T, amberMin: 0 })).toMatch(/above 0/);
    expect(validateThresholds({ ...T, minTasks: 0 })).toMatch(/whole number/);
    expect(validateThresholds({ ...T, greenMin: Number.NaN })).toMatch(/number/);
  });
});
