import { describe, expect, it } from 'vitest';
import { spreadDaily, cumulativeAt, actualSpendItems, monthly } from '../src';

describe('time-phasing', () => {
  it('spreads evenly over weekdays: 40 over Mon-Fri = 8 a day', () => {
    const r = spreadDaily([{ id: 'a', amount: 40, start: '2026-03-23', end: '2026-03-27' }], 'weekdays');
    expect([...r.days.values()]).toEqual([8, 8, 8, 8, 8]);
    expect(r.spread).toBe(40);
  });
  it('a holiday takes a day out: 40 over four days = 10 a day', () => {
    const r = spreadDaily([{ id: 'a', amount: 40, start: '2026-03-23', end: '2026-03-27' }], { mode: 'weekdays', holidays: ['2026-03-25'] });
    expect(r.days.get('2026-03-25')).toBeUndefined();
    expect(r.days.get('2026-03-24')).toBe(10);
  });
  it('weekend-only span goes on its end date; missing dates are listed; zero is skipped', () => {
    const r = spreadDaily([
      { id: 'w', amount: 6, start: '2026-03-28', end: '2026-03-29' },
      { id: 'n', amount: 5, start: null, end: '2026-03-29' },
      { id: 'b', amount: 5, start: '2026-04-02', end: '2026-04-01' },
      { id: 'z', amount: 0, start: null, end: null },
    ], 'weekdays');
    expect(r.days.get('2026-03-29')).toBe(6);
    expect(r.left).toEqual([{ id: 'n', reason: 'no usable dates' }, { id: 'b', reason: 'end before start' }]);
    expect(r.total).toBe(16);
    expect(r.spread).toBe(6);
  });
  it('cumulative line: null after the status date, earlier spend folded into the first point', () => {
    const days = new Map([['2026-03-20', 5], ['2026-03-24', 10], ['2026-03-26', 10]]);
    const c = cumulativeAt(days, ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26'], '2026-03-25');
    expect(c).toEqual([5, 15, 15, null]);
  });
  it('actual spend: open work runs to the status date; finished work stops at its finish; start after status is left out', () => {
    const r = actualSpendItems([
      { id: 'open', amount: 30, start: '2026-03-30', finish: null },
      { id: 'done', amount: 20, start: '2026-03-23', finish: '2026-03-24' },
      { id: 'late', amount: 9, start: '2026-04-05', finish: null },
      { id: 'nostart', amount: 4, start: null, finish: null },
      { id: 'nil', amount: 0, start: null, finish: null },
    ], '2026-04-01');
    expect(r.items).toEqual([
      { id: 'open', amount: 30, start: '2026-03-30', end: '2026-04-01' },
      { id: 'done', amount: 20, start: '2026-03-23', end: '2026-03-24' },
    ]);
    expect(r.left.map((x) => [x.id, x.reason])).toEqual([['late', 'actual start is after the status date'], ['nostart', 'no actual start date']]);
    const sp = spreadDaily(r.items, 'weekdays');
    expect(sp.days.get('2026-03-31')).toBe(10); // 30 over Mon, Tue, Wed
  });
  it('monthly: 50 over Mon 03-30 to Fri 04-03 = 20 in March and 30 in April; empty months are filled', () => {
    const p = spreadDaily([{ id: 'a', amount: 50, start: '2026-03-30', end: '2026-04-03' }], 'weekdays').days;
    const a = new Map([['2026-05-04', 7]]);
    const m = monthly(p, a);
    expect(m.map((x) => [x.month, x.planned, x.actual])).toEqual([['2026-03', 20, 0], ['2026-04', 30, 0], ['2026-05', 0, 7]]);
    expect(m[2]!.plannedCum).toBe(50);
    expect(m[2]!.actualCum).toBe(7);
    expect(monthly(new Map(), new Map())).toEqual([]);
  });
});
