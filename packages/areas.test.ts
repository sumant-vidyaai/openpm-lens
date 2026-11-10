import { describe, expect, it } from 'vitest';
import { analyseFinish, diffDays, type FinishItem } from '../src/finishVariance';
import { analyseMoney, type MoneyTask } from '../src/money';
import { analyseResources, splitPeople, weekStart, type ResourceTask } from '../src/resource';

const F = (id: string, planned: string | null, actual: string | null, x: Partial<FinishItem> = {}): FinishItem =>
  ({ id, name: id, plannedFinish: planned, actualFinish: actual, cancelled: false, markedDone: false, issues: [], ...x });

describe('analyseFinish (hand-checked)', () => {
  const items = [
    F('a', '2026-01-09', '2026-01-09'), F('b', '2026-01-16', '2026-01-20'), F('c', '2026-01-23', '2026-01-21'),
    F('d', '2026-01-30', '2026-02-03'), F('e', '2026-02-06', '2026-02-06'),
    F('f', '2026-02-04', null), F('g', '2026-02-20', null),
    F('h', '2026-01-10', null, { cancelled: true }), F('i', '2026-01-10', null, { markedDone: true }), F('j', null, '2026-01-10'),
  ];
  const r = analyseFinish(items, '2026-02-10');
  it('variance, on time and statistics', () => {
    expect(r.rows.map((x) => x.days)).toEqual([0, 4, -2, 4, 0]);
    expect(r.finished).toBe(5);
    expect(r.onTime).toBe(3);
    expect(r.late).toBe(2);
    expect(r.onTimePercent).toBe(60);
    expect(r.meanVariance).toBeCloseTo(1.2);
    expect(r.medianVariance).toBe(0); // sorted -2,0,0,4,4 ; rank 3
    expect(r.worstLate).toBe(4);
  });
  it('overdue, not yet due and left out', () => {
    expect(r.overdue.map((x) => [x.id, x.days])).toEqual([['f', 6]]);
    expect(r.notYetDue).toBe(1);
    expect(r.excluded.map((x) => x.id).sort()).toEqual(['h', 'i', 'j']);
  });
  it('accounts for every task exactly once', () => {
    expect(r.finished + r.overdue.length + r.notYetDue + r.excluded.length).toBe(items.length);
  });
  it('withholds percentages below the minimum', () => {
    const x = analyseFinish([F('a', '2026-01-09', '2026-01-09')], '2026-02-10');
    expect(x.onTimePercent).toBeNull();
    expect(x.medianVariance).toBeNull();
    expect(x.caveats.join(' ')).toContain('Insufficient data');
  });
  it('a finish after the status date is still open', () => {
    const x = analyseFinish([F('a', '2026-01-09', '2026-03-01')], '2026-02-10');
    expect(x.finished).toBe(0);
    expect(x.overdue).toHaveLength(1);
  });
  it('diffDays is signed', () => expect(diffDays('2026-01-10', '2026-01-08')).toBe(-2));
});

describe('analyseMoney (hand-checked)', () => {
  const T = (id: string, who: string | null, p: number | null, a: number | null, pct: number | null): MoneyTask =>
    ({ id, assignee: who, plannedHours: p, actualHours: a, percentComplete: pct });
  const tasks = [T('t1', 'Ann', 10, 12, 100), T('t2', 'Bob', 20, 10, 50), T('t3', null, 8, 4, 50), T('t4', 'Ann; Bob', 5, 5, 100), T('t5', 'Cy; Di', 10, 10, 100), T('t6', 'Ann', null, 1, 10)];
  it('uses own rate, then the default rate', () => {
    const r = analyseMoney(tasks, { defaultRate: 30, byPerson: { Ann: 50 } });
    expect(r.ev).toBeCloseTo(1220); // 500 + 300 + 120 + 300
    expect(r.ac).toBeCloseTo(1320); // 600 + 300 + 120 + 300
    expect(r.bac).toBeCloseTo(1640);
    expect(r.cpi).toBeCloseTo(1220 / 1320);
    expect(r.cv).toBeCloseTo(-100);
    expect(r.used).toBe(4);
    expect(r.excluded.map((x) => x.id).sort()).toEqual(['t4', 't6']);
    expect(r.hoursCpi).toBeCloseTo(34 / 36);
    expect(r.caveats.join(' ')).toContain('different rates');
  });
  it('leaves tasks out when no rate exists (never guesses)', () => {
    const r = analyseMoney(tasks, { defaultRate: null, byPerson: { Ann: 50 } });
    expect(r.used).toBe(1); // only t1
    expect(r.excluded.find((x) => x.id === 't2')?.reason).toContain('no rate');
    expect(r.ev).toBeCloseTo(500);
  });
  it('a single rate for everyone gives the same CPI as hours', () => {
    const r = analyseMoney(tasks.slice(0, 3), { defaultRate: 40, byPerson: {} });
    expect(r.cpi).toBeCloseTo(r.hoursCpi as number);
  });
  it('ignores invalid rates', () => {
    const r = analyseMoney([T('x', 'Ann', 10, 10, 100)], { defaultRate: -5, byPerson: { Ann: Number.NaN } });
    expect(r.used).toBe(0);
    expect(r.ev).toBeNull();
  });
});

describe('analyseResources (hand-checked)', () => {
  const R = (id: string, who: string | null, h: number | null, s: string | null, f: string | null, a: number | null = null): ResourceTask =>
    ({ id, assignee: who, plannedHours: h, plannedStart: s, plannedFinish: f, actualHours: a });
  const tasks = [
    R('1', 'A', 40, '2026-01-05', '2026-01-09', 44), R('2', 'A', 20, '2026-01-12', '2026-01-23', 10), R('3', 'A', 8, '2026-01-07', '2026-01-07'),
    R('4', 'B', 30, '2026-01-09', '2026-01-12'), R('5', null, 10, '2026-01-12', '2026-01-16'), R('6', 'A; B', 10, '2026-01-12', '2026-01-16'),
  ];
  const r = analyseResources(tasks, { capacityDefault: 40, capacityByPerson: {}, mode: 'weekdays', overPercent: 100 });
  const A = r.people.find((p) => p.person === 'A');
  it('weeks run Monday to Sunday', () => {
    expect(weekStart('2026-01-11')).toBe('2026-01-05'); // a Sunday
    expect(weekStart('2026-01-12')).toBe('2026-01-12');
    expect(r.weeks).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
  });
  it('weekly load and utilisation', () => {
    expect(A?.weeks.map((w) => w.planned)).toEqual([48, 10, 10]); // 40 + 8 ; 20/10 days x 5 ; same
    expect(A?.weeks.map((w) => w.utilisation)).toEqual([120, 25, 25]);
    expect(A?.overWeeks).toBe(1);
    expect(A?.peak).toBe(120);
  });
  it('a task across a weekend splits over the weekdays', () => {
    const B = r.people.find((p) => p.person === 'B');
    expect(B?.weeks.map((w) => w.planned)).toEqual([15, 15, 0]); // Fri 9 and Mon 12: 15 h each
  });
  it('unassigned load is kept apart and several-person tasks are left out', () => {
    expect(r.people.at(-1)?.person).toBe('(unassigned)');
    expect(r.people.at(-1)?.weeks[1]?.planned).toBe(10);
    expect(r.excluded.find((x) => x.id === '6')?.reason).toContain('several people');
  });
  it('planned vs actual per person uses tasks that have both', () => {
    expect(A?.plannedForActual).toBe(60);
    expect(A?.actualTotal).toBe(54);
    expect(A?.actualVsPlanned).toBeCloseTo(0.9);
  });
  it('own capacity and the flag limit are respected', () => {
    const x = analyseResources(tasks, { capacityDefault: 40, capacityByPerson: { a: 60 }, mode: 'weekdays', overPercent: 100 });
    expect(x.people.find((p) => p.person === 'A')?.weeks[0]?.utilisation).toBeCloseTo(80); // 48 / 60
    expect(x.people.find((p) => p.person === 'A')?.overWeeks).toBe(0);
  });
  it('splits names on semicolons only', () => {
    expect(splitPeople('Smith, Ann')).toEqual(['Smith, Ann']);
    expect(splitPeople(' A ;B;; ')).toEqual(['A', 'B']);
    expect(splitPeople(null)).toEqual([]);
  });
});
