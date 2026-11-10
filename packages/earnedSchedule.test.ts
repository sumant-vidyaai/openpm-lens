import { describe, expect, it } from 'vitest';
import { earnedSchedule, plannedValueCurve } from '../src/earnedSchedule';
import { aggregateSchedule, type ScheduleTask } from '../src/schedule';

const T = (id: string, h: number, pct: number, s: string, f: string): ScheduleTask => ({ id, plannedHours: h, percentComplete: pct, plannedStart: s, plannedFinish: f });

describe('plannedValueCurve', () => {
  it('spreads evenly over weekdays', () => {
    const c = plannedValueCurve([T('a', 40, 0, '2026-01-05', '2026-01-09')], 'weekdays');
    expect(c.dates).toHaveLength(5);
    expect(c.pv).toEqual([8, 16, 24, 32, 40]);
  });
  it('skips weekends between tasks in weekday mode', () => {
    const c = plannedValueCurve([T('a', 10, 0, '2026-01-09', '2026-01-12')], 'weekdays'); // Fri, Mon
    expect(c.dates).toEqual(['2026-01-09', '2026-01-12']);
    expect(c.pv).toEqual([5, 10]);
  });
  it('matches aggregateSchedule PV at the status date', () => {
    const tasks = [T('a', 40, 100, '2026-01-05', '2026-01-09'), T('b', 80, 50, '2026-01-12', '2026-01-23'), T('c', 30, 40, '2026-01-12', '2026-01-16')];
    const status = '2026-01-21';
    const curve = plannedValueCurve(tasks, 'weekdays');
    const i = curve.dates.indexOf(status);
    expect(curve.pv[i]).toBeCloseTo(aggregateSchedule(tasks, status, 'weekdays').pv as number, 9);
  });
});

describe('earnedSchedule (hand-checked)', () => {
  it('single task, halfway through its earning: ES 2.5, AT 3', () => {
    // 40 h over Mon-Fri; 50% done = EV 20; PV by day 8,16,24,... so C=2, I=(20-16)/8=0.5.
    const r = earnedSchedule([T('a', 40, 50, '2026-01-05', '2026-01-09')], '2026-01-07', 'weekdays');
    expect(r.es).toBeCloseTo(2.5);
    expect(r.at).toBe(3);
    expect(r.svT).toBeCloseTo(-0.5);
    expect(r.spiT).toBeCloseTo(2.5 / 3);
  });
  it('keeps showing delay where classic SPI would recover', () => {
    // Two tasks, 10 weekdays planned. Both fully done, but only by 2026-01-30 (AT = 20).
    const tasks = [T('a', 40, 100, '2026-01-05', '2026-01-09'), T('b', 40, 100, '2026-01-12', '2026-01-16')];
    const r = earnedSchedule(tasks, '2026-01-30', 'weekdays');
    expect(r.capped).toBe(true);
    expect(r.es).toBe(10);
    expect(r.at).toBe(20);
    expect(r.spiT).toBeCloseTo(0.5);
    expect(aggregateSchedule(tasks, '2026-01-30', 'weekdays').spi).toBe(1); // classic SPI says "all good"
  });
  it('stalled project: ES stays put while AT grows', () => {
    // First task done, second at 0%. By 2026-01-30 (AT=20): ES = 5, SPI(t) = 0.25; classic SPI = 40/80 = 0.5.
    const tasks = [T('a', 40, 100, '2026-01-05', '2026-01-09'), T('b', 40, 0, '2026-01-12', '2026-01-16')];
    const r = earnedSchedule(tasks, '2026-01-30', 'weekdays');
    expect(r.es).toBeCloseTo(5);
    expect(r.spiT).toBeCloseTo(0.25);
    expect(aggregateSchedule(tasks, '2026-01-30', 'weekdays').spi).toBeCloseTo(0.5);
  });
  it('calendar mode counts weekends', () => {
    // 40 h over Sat 3 Jan to Tue 6 Jan = 4 calendar days, 10 h each. EV 15 -> C=1, ES=1.5. Status Mon 5 Jan: AT=3.
    const r = earnedSchedule([T('a', 40, 37.5, '2026-01-03', '2026-01-06')], '2026-01-05', 'calendar');
    expect(r.es).toBeCloseTo(1.5);
    expect(r.at).toBe(3);
  });
  it('is not available before the first planned start', () => {
    const r = earnedSchedule([T('a', 40, 0, '2026-01-12', '2026-01-16')], '2026-01-05', 'weekdays');
    expect(r.status).toBe('not_available');
    expect(r.reasons.join(' ')).toContain('before the first planned start');
  });
  it('is not available without usable tasks', () => {
    expect(earnedSchedule([{ id: 'x', plannedHours: null, percentComplete: 10, plannedStart: null, plannedFinish: null }], '2026-01-05', 'weekdays').status).toBe('not_available');
  });
  it('EV 0 gives ES 0 and SPI(t) 0', () => {
    const r = earnedSchedule([T('a', 40, 0, '2026-01-05', '2026-01-09')], '2026-01-07', 'weekdays');
    expect(r.es).toBe(0);
    expect(r.spiT).toBe(0);
  });
  it('shows the working with the real numbers', () => {
    const r = earnedSchedule([T('a', 40, 50, '2026-01-05', '2026-01-09')], '2026-01-07', 'weekdays');
    const text = r.steps.map((s) => s.steps.join(' ')).join(' ');
    expect(text).toContain('PV_2 = 16');
    expect(text).toContain('ES = 2 + (20 - 16) / (24 - 16)');
  });
});
