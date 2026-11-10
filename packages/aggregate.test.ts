import { describe, expect, it } from 'vitest';
import { aggregateHoursEvm, type HoursTask } from '../src/aggregate';
import { costPerformanceIndex } from '../src/evm';
import { roundHalfUp } from '../src/format';

/**
 * The three-task example agreed with the project owner:
 *
 *   Task A: planned 8.5 h, actual 10 h, 100% complete
 *   Task B: planned (blank), actual 4 h, 50% complete
 *   Task C: planned 20 h, actual 6 h, 30% complete
 *
 * Policy "exclude" (default): B is left out.
 *   EV = 8.5 x 100% + 20 x 30% = 8.5 + 6 = 14.5
 *   AC = 10 + 6 = 16
 *   CPI = 14.5 / 16 = 0.90625 -> shown as 0.91
 *
 * Policy "treat_as_zero": B counts with planned = 0 (its 4 actual hours still count).
 *   EV = 14.5, AC = 10 + 4 + 6 = 20
 *   CPI = 14.5 / 20 = 0.725 -> shown as 0.73
 */
const tasks: HoursTask[] = [
  { id: 'A', plannedHours: 8.5, actualHours: 10, percentComplete: 100 },
  { id: 'B', plannedHours: null, actualHours: 4, percentComplete: 50 },
  { id: 'C', plannedHours: 20, actualHours: 6, percentComplete: 30 },
];

describe('aggregateHoursEvm: default policy "exclude"', () => {
  const agg = aggregateHoursEvm(tasks);

  it('leaves out the task with no planned hours and says so', () => {
    expect(agg.status).toBe('computed_with_caveats');
    expect(agg.counts).toEqual({ total: 3, used: 2, excluded: 1, assumedZeroPlanned: 0 });
    expect(agg.excluded).toEqual([{ id: 'B', reason: 'no planned hours' }]);
    expect(agg.caveats).toEqual(['1 of 3 tasks excluded (no planned hours).']);
  });

  it('computes EV, AC, BAC from the usable tasks', () => {
    expect(agg.ev).toBeCloseTo(14.5, 10);
    expect(agg.ac).toBe(16);
    expect(agg.bac).toBe(28.5);
  });

  it('gives CPI 0.90625, displayed 0.91', () => {
    const cpi = costPerformanceIndex(agg.ev as number, agg.ac as number) as number;
    expect(cpi).toBeCloseTo(0.90625, 10);
    expect(roundHalfUp(cpi, 2)).toBe(0.91);
  });
});

describe('aggregateHoursEvm: policy "treat_as_zero"', () => {
  const agg = aggregateHoursEvm(tasks, 'treat_as_zero');

  it('flags the assumption on the result', () => {
    expect(agg.status).toBe('computed_with_caveats');
    expect(agg.counts.assumedZeroPlanned).toBe(1);
    expect(agg.excluded).toEqual([]);
    expect(agg.caveats[0]).toContain('Assumption');
    expect(agg.caveats[0]).toContain('1 of 3');
  });

  it('gives CPI 0.725, displayed 0.73', () => {
    expect(agg.ev).toBeCloseTo(14.5, 10);
    expect(agg.ac).toBe(20);
    const cpi = costPerformanceIndex(agg.ev as number, agg.ac as number) as number;
    expect(cpi).toBeCloseTo(0.725, 10);
    expect(roundHalfUp(cpi, 2)).toBe(0.73);
  });
});

describe('aggregateHoursEvm: other missing data', () => {
  it('reports "computed" with no caveats when every task is complete', () => {
    const agg = aggregateHoursEvm([tasks[0] as HoursTask, tasks[2] as HoursTask]);
    expect(agg.status).toBe('computed');
    expect(agg.caveats).toEqual([]);
  });

  it('never defaults missing actual hours or percent complete', () => {
    const agg = aggregateHoursEvm([
      { id: 'X', plannedHours: 10, actualHours: null, percentComplete: 50 },
      { id: 'Y', plannedHours: 10, actualHours: 5, percentComplete: null },
      { id: 'Z', plannedHours: 10, actualHours: 5, percentComplete: 50 },
    ]);
    expect(agg.excluded).toEqual([
      { id: 'X', reason: 'no actual hours' },
      { id: 'Y', reason: 'no % complete' },
    ]);
    expect(agg.caveats[0]).toContain('1 no actual hours; 1 no % complete');
    expect(agg.counts.used).toBe(1);
  });

  it('is not_available, naming the missing fields, when nothing is usable', () => {
    const agg = aggregateHoursEvm([{ id: 'B', plannedHours: null, actualHours: 4, percentComplete: 50 }]);
    expect(agg.status).toBe('not_available');
    expect(agg.ev).toBeNull();
    expect(agg.missing).toEqual(['plannedHours']);
  });

  it('is not_available for an empty task list', () => {
    const agg = aggregateHoursEvm([]);
    expect(agg.status).toBe('not_available');
    expect(agg.missing).toEqual(['tasks']);
  });
});
