import { describe, expect, it } from 'vitest';
import {
  aggregateHoursEvm, aggregateSchedule, evmSteps, explainEvmRows, explainScheduleRows, scheduleSteps,
  type HoursTask, type ScheduleTask,
} from '../src';

const hours: HoursTask[] = [
  { id: 'a', plannedHours: 40, actualHours: 46, percentComplete: 100 },
  { id: 'b', plannedHours: 60, actualHours: 30, percentComplete: 50 },
  { id: 'c', plannedHours: 80, actualHours: 20, percentComplete: 25 },
  { id: 'd', plannedHours: 16, actualHours: null, percentComplete: 0 },
  { id: 'e', plannedHours: null, actualHours: 12, percentComplete: 100 },
];
const sched: ScheduleTask[] = [
  { id: 'a', plannedHours: 40, percentComplete: 100, plannedStart: '2026-01-05', plannedFinish: '2026-01-09' },
  { id: 'b', plannedHours: 80, percentComplete: 50, plannedStart: '2026-01-12', plannedFinish: '2026-01-23' },
  { id: 'c', plannedHours: 24, percentComplete: 0, plannedStart: '2026-01-26', plannedFinish: '2026-01-28' },
  { id: 'd', plannedHours: 16, percentComplete: 0, plannedStart: null, plannedFinish: null },
];

describe('explanation rows add up to the headline numbers', () => {
  for (const policy of ['exclude', 'treat_as_zero'] as const) {
    it(`cost rows match the aggregate (${policy})`, () => {
      const agg = aggregateHoursEvm(hours, policy);
      const rows = explainEvmRows(hours, policy);
      expect(rows.filter((r) => r.used).length).toBe(agg.counts.used);
      expect(rows.reduce((s, r) => s + (r.ev ?? 0), 0)).toBeCloseTo(agg.ev as number);
      expect(rows.reduce((s, r) => s + (r.ac ?? 0), 0)).toBeCloseTo(agg.ac as number);
    });
  }
  it('schedule rows match the aggregate on a weekday and a calendar basis', () => {
    for (const mode of ['weekdays', 'calendar'] as const) {
      const agg = aggregateSchedule(sched, '2026-01-21', mode);
      const rows = explainScheduleRows(sched, '2026-01-21', mode);
      expect(rows.filter((r) => r.used).length).toBe(agg.counts.used);
      expect(rows.reduce((s, r) => s + (r.pv ?? 0), 0)).toBeCloseTo(agg.pv as number);
      expect(rows.reduce((s, r) => s + (r.ev ?? 0), 0)).toBeCloseTo(agg.ev as number);
    }
  });
  it('says why each task was left out', () => {
    const notes = explainEvmRows(hours).map((r) => r.note);
    expect(notes[3]).toContain('no actual hours');
    expect(notes[4]).toContain('no planned hours');
    expect(explainScheduleRows(sched, '2026-01-21', 'weekdays')[3]?.note).toContain('no usable planned dates');
  });
});

describe('formula steps use the real numbers (hand-checked)', () => {
  it('cost: EV 90, AC 96 gives CPI 0.9375 and CV -6', () => {
    // a: EV 40, AC 46. b: EV 30, AC 30. c: EV 20, AC 20 -> EV 90, AC 96.
    const text = evmSteps(aggregateHoursEvm(hours)).flatMap((g) => g.steps).join('\n');
    expect(text).toContain('CPI = 90 / 96');
    expect(text).toContain('CPI = 0.9375, shown as 0.94');
    expect(text).toContain('CV = 90 - 96');
    expect(text).toContain('CV = -6 hours');
  });
  it('schedule: PV 104, EV 80 on 21 Jan gives SPI 0.7692 and SV -24', () => {
    const agg = aggregateSchedule(sched.slice(0, 3), '2026-01-21', 'weekdays');
    const text = scheduleSteps(agg, '2026-01-21', 'weekdays').flatMap((g) => g.steps).join('\n');
    expect(text).toContain('SPI = 80 / 104');
    expect(text).toContain('SPI = 0.7692, shown as 0.77');
    expect(text).toContain('SV = -24 hours');
  });
  it('explains a zero divisor instead of showing a number', () => {
    const agg = aggregateSchedule(sched.slice(0, 3), '2026-01-01', 'weekdays');
    expect(scheduleSteps(agg, '2026-01-01', 'weekdays').flatMap((g) => g.steps).join(' ')).toContain('SPI is not available');
  });
});
