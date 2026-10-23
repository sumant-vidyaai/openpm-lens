import { describe, expect, it } from 'vitest';
import { sumSubset, type EvmRow, type ScheduleRow } from '../src';

const e = (id: string, plannedHours: number | null, ev: number | null, ac: number | null, used = true): EvmRow => ({ id, plannedHours, actualHours: ac, percentComplete: null, ev, ac, used, note: '' });
const s = (id: string, pv: number | null, ev: number | null, used = true): ScheduleRow => ({ id, plannedHours: null, plannedStart: null, plannedFinish: null, percentComplete: null, plannedShare: null, pv, ev, used, note: '' });

describe('sumSubset', () => {
  const evm = [e('a', 10, 5, 6), e('b', 20, 20, 18), e('c', 8, null, null, false), e('d', 4, 1, 2)];
  const sch = [s('a', 8, 5), s('b', 20, 20), s('c', null, null, false), s('d', 4, 1)];
  it('adds only the chosen, usable rows (hand-worked)', () => {
    const r = sumSubset(evm, sch, [0, 1, 2]);
    expect(r).toMatchObject({ ev: 25, ac: 24, bac: 30, pv: 28, evSchedule: 25, costTasks: 2, scheduleTasks: 2 });
  });
  it('all rows equal the whole-file sums', () => {
    expect(sumSubset(evm, sch, [0, 1, 2, 3])).toMatchObject({ ev: 26, ac: 26, bac: 34, pv: 32, evSchedule: 26 });
  });
  it('a group with nothing usable gives null, not 0', () => {
    expect(sumSubset(evm, sch, [2])).toMatchObject({ ev: null, ac: null, bac: null, pv: null, evSchedule: null, costTasks: 0 });
    expect(sumSubset(evm, sch, [])).toMatchObject({ ev: null });
  });
});
