import { describe, expect, it } from 'vitest';
import {
  addDaysIso, chanceByDate, chanceWithin, forecastMilestones, historyVerdict, simulateFinish, summarise, weeklyThroughput, weeksAtConfidence, type GateItem,
} from '../src';

// 2026-03-31 is a Tuesday. Week 1 (most recent) = 03-25..03-31, week 2 = 03-18..03-24, week 3 = 03-11..03-17.
describe('weekly throughput history (hand-worked)', () => {
  const fin = ['2026-03-31', '2026-03-25', '2026-03-24', '2026-03-18', '2026-03-17', '2026-03-11'];
  it('counts two per week over three full weeks, oldest first', () => {
    const h = weeklyThroughput(fin, '2026-03-31', 3, '2026-03-11');
    expect(h.weekly).toEqual([2, 2, 2]);
    expect(h.windowStart).toBe('2026-03-11');
    expect(h.finishedInWindow).toBe(6);
  });
  it('keeps quiet weeks as 0 and reports items outside the window', () => {
    const h = weeklyThroughput([...fin, '2026-03-10', '2026-04-02'], '2026-03-31', 2, '2026-03-01');
    expect(h.weekly).toEqual([2, 2]);
    expect(h.finishedBefore).toBe(3); // 03-17, 03-11 and 03-10 are older than two weeks
    expect(h.finishedAfter).toBe(1);
    const quiet = weeklyThroughput(['2026-03-31'], '2026-03-31', 3, '2026-03-11');
    expect(quiet.weekly).toEqual([0, 0, 1]);
  });
  it('never reaches before the project start (no fake quiet weeks)', () => {
    expect(weeklyThroughput(fin, '2026-03-31', 12, '2026-03-20').weekly.length).toBe(1); // 12 days = 1 full week
    expect(weeklyThroughput(fin, '2026-03-31', 12, null).weekly.length).toBe(Math.floor((20 + 1) / 7)); // first finish 03-11 -> 21 days -> 3 weeks
  });
  it('no usable dates gives an empty history', () => {
    expect(weeklyThroughput([], '2026-03-31', 12, null).weekly).toEqual([]);
  });
});

describe('simulation', () => {
  it('a steady 2 per week and 7 items always takes 4 weeks', () => {
    const d = simulateFinish([2, 2, 2, 2], 7, 2000, 1)!;
    expect([0.5, 0.85, 0.95].map((p) => weeksAtConfidence(d, p))).toEqual([4, 4, 4]);
    expect(chanceWithin(d, 3)).toBe(0);
    expect(chanceWithin(d, 4)).toBe(1);
  });
  it('8 items at 2 per week is exactly 4 weeks; 0 items is 0 weeks', () => {
    expect(weeksAtConfidence(simulateFinish([2, 2], 8, 500, 1)!, 0.95)).toBe(4);
    expect(weeksAtConfidence(simulateFinish([2, 2], 0, 500, 1)!, 0.95)).toBe(0);
  });
  it('weeks [0, 4] and 4 items: finish in week k with chance 0.5^k, so 85% is week 3 and 95% is week 5', () => {
    const d = simulateFinish([0, 4], 4, 20000, 7)!;
    expect(weeksAtConfidence(d, 0.85)).toBe(3); // P(<=2) = .75 < .85 <= P(<=3) = .875
    expect(weeksAtConfidence(d, 0.95)).toBe(5); // P(<=4) = .9375 < .95 <= P(<=5) = .96875
    expect(chanceWithin(d, 1)).toBeCloseTo(0.5, 1);
    expect(chanceWithin(d, 2)).toBeCloseTo(0.75, 1);
  });
  it('the same seed gives the same answer', () => {
    const a = simulateFinish([0, 1, 3, 2, 5], 20, 3000, 42)!;
    const b = simulateFinish([0, 1, 3, 2, 5], 20, 3000, 42)!;
    expect(a.cum).toEqual(b.cum);
  });
  it('refuses to forecast when nothing was finished (never invents a pace)', () => {
    expect(simulateFinish([0, 0, 0], 5, 100, 1)).toBeNull();
    expect(simulateFinish([], 5, 100, 1)).toBeNull();
  });
  it('dates: 3 weeks after 2026-03-31 is 2026-04-21; chance by a date uses whole weeks', () => {
    expect(addDaysIso('2026-03-31', 21)).toBe('2026-04-21');
    const d = simulateFinish([2, 2], 6, 500, 1)!; // always 3 weeks
    expect(summarise(d, '2026-03-31').date85).toBe('2026-04-21');
    expect(chanceByDate(d, '2026-03-31', '2026-04-20')).toBe(0); // 20 days = 2 whole weeks
    expect(chanceByDate(d, '2026-03-31', '2026-04-21')).toBe(1);
  });
});

describe('history verdict (starting rules)', () => {
  const h = (n: number, fin = 5) => ({ weekly: new Array<number>(n).fill(1), windowStart: 'x', windowEnd: 'y', finishedInWindow: fin, finishedBefore: 0, finishedAfter: 0 });
  it('none, too short, short, ok, long', () => {
    expect(historyVerdict(h(8, 0))).toBe('none');
    expect(historyVerdict(h(3))).toBe('too_short');
    expect(historyVerdict(h(5))).toBe('warn_short');
    expect(historyVerdict(h(12))).toBe('ok');
    expect(historyVerdict(h(30))).toBe('warn_long');
  });
});

describe('milestone forecast', () => {
  const it_ = (id: string, plannedFinish: string | null, over: Partial<GateItem> = {}): GateItem => ({ id, name: id, plannedFinish, done: false, cancelled: false, excluded: false, ...over });
  const items: GateItem[] = [
    it_('a', '2026-04-03'), it_('b', '2026-04-07'), it_('c', '2026-04-10'), it_('d', '2026-04-13'), it_('e', '2026-04-14'),
    it_('f', '2026-04-20'), it_('g', '2026-04-28'),
    it_('done', '2026-04-01', { done: true }), it_('x', '2026-04-02', { cancelled: true }), it_('m', '2026-04-14', { excluded: true }), it_('nodate', null),
  ];
  const r = forecastMilestones([{ id: 'M1', name: 'Beta', planned: '2026-04-14' }, { id: 'M2', name: 'Go-live', planned: '2026-04-28' }, { id: 'M3', name: 'No date', planned: null }], items, [2, 2, 2], '2026-03-31', 1000, 1);
  it('gating work = open items planned on or before the milestone (done, cancelled, excluded and undated are not counted)', () => {
    expect(r[0]!.gating).toBe(5);
    expect(r[1]!.gating).toBe(7);
  });
  it('5 items at 2 per week = 3 weeks (2026-04-21); only 2 whole weeks are allowed before 04-14, so the chance is 0', () => {
    expect(r[0]!.summary!.date85).toBe('2026-04-21');
    expect(r[0]!.chance).toBe(0);
  });
  it('7 items = 4 weeks (2026-04-28), exactly the planned date, so the chance is 1', () => {
    expect(r[1]!.summary!.date85).toBe('2026-04-28');
    expect(r[1]!.chance).toBe(1);
  });
  it('a milestone with no planned date is listed without a forecast', () => {
    expect(r[2]!.summary).toBeNull();
    expect(r[2]!.chance).toBeNull();
  });
});
