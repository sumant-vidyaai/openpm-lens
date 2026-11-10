import { describe, expect, it } from 'vitest';
import { costContributors, scheduleContributors, fixFirst, analyseMilestones, type EvmRow, type ScheduleRow } from '../src';

const E = (id: string, ev: number | null, ac: number | null, used = true, note = 'Used'): EvmRow =>
  ({ id, plannedHours: null, actualHours: ac, percentComplete: null, ev, ac, used, note });

describe('why is it red: cost', () => {
  // CV: A -10, B +5, C -10, D -1; E not used.  Shortfall 21, surplus 5, net -16.
  const rows = [E('A', 10, 20), E('B', 30, 25), E('C', 0, 10), E('D', 5, 6), E('E', null, null, false, 'Left out: no actual hours')];
  it('ranks the negative variances, with shares of the shortfall', () => {
    const r = costContributors(rows, 2);
    expect(r.shortfall).toBeCloseTo(21, 10);
    expect(r.surplus).toBeCloseTo(5, 10);
    expect(r.net).toBeCloseTo(-16, 10);
    expect(r.items.map((x) => x.id)).toEqual(['A', 'C']); // tie keeps list order
    expect(r.items[0]!.share).toBeCloseTo(10 / 21, 10);
    expect(r.negativeTasks).toBe(3);
    expect(r.notShown).toBe(1);
  });
  it('net equals EV - AC over the tasks used', () => {
    const ev = 10 + 30 + 0 + 5, ac = 20 + 25 + 10 + 6;
    expect(costContributors(rows).net).toBeCloseTo(ev - ac, 10);
  });
  it('nothing negative: empty list, shortfall 0', () => {
    const r = costContributors([E('A', 10, 5)]);
    expect(r.items).toEqual([]);
    expect(r.shortfall).toBe(0);
  });
});

describe('why is it red: schedule', () => {
  const S = (id: string, ev: number, pv: number): ScheduleRow => ({ id, plannedHours: 0, plannedStart: null, plannedFinish: null, percentComplete: null, plannedShare: null, pv, ev, used: true, note: 'Used' });
  it('uses ev - pv', () => {
    const r = scheduleContributors([S('a', 4, 10), S('b', 9, 6), S('c', 2, 3)]);
    expect(r.items.map((x) => [x.id, x.variance])).toEqual([['a', -6], ['c', -1]]);
    expect(r.net).toBeCloseTo((4 + 9 + 2) - (10 + 6 + 3), 10);
  });
});

describe('fix these first', () => {
  it('groups left-out tasks by what is missing and skips cancelled ones', () => {
    const evm = [E('1', null, null, false, 'Left out: no actual hours'), E('2', null, null, false, 'Left out: no actual hours'), E('3', null, null, false, 'Left out: no % complete'), E('4', 1, 1)];
    const sched: ScheduleRow[] = [];
    const r = fixFirst(evm, sched, [false, false, true, false]);
    expect(r.groups).toEqual([{ area: 'Cost', reason: 'no actual hours', count: 2, ids: ['1', '2'] }]);
    expect(r.cancelledCount).toBe(1);
  });
});

describe('milestones', () => {
  const M = (id: string, planned: string | null, actual: string | null, done: boolean, cancelled = false) => ({ id, name: id, planned, actual, done, cancelled });
  it('classifies by status date 2026-03-31', () => {
    const r = analyseMilestones([
      M('a', '2026-03-10', '2026-03-10', true), // on time
      M('b', '2026-03-10', '2026-03-14', true), // 4 days late
      M('c', '2026-03-20', null, false), // overdue 11 days
      M('d', '2026-04-10', null, false), // due in 10 days: soon
      M('e', '2026-05-01', null, false), // 31 days: upcoming
      M('f', null, null, false), // no date
      M('g', '2026-03-12', null, true), // done, no actual date
      M('h', '2026-03-05', null, false, true), // cancelled
    ], '2026-03-31');
    const by = Object.fromEntries(r.rows.map((x) => [x.id, [x.state, x.days]]));
    expect(by.a).toEqual(['done_on_time', 0]);
    expect(by.b).toEqual(['done_late', 4]);
    expect(by.c).toEqual(['overdue', 11]);
    expect(by.d).toEqual(['due_soon', 10]);
    expect(by.e).toEqual(['upcoming', 31]);
    expect(by.f).toEqual(['no_planned_date', null]);
    expect(by.g).toEqual(['done_no_date', null]);
    expect(r.cancelled).toBe(1);
    expect(r.averageSlip).toBeCloseTo(2, 10); // (0 + 4) / 2
  });
});
