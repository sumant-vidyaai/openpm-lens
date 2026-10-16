import { describe, expect, it } from 'vitest';
import {
  aggregateHoursEvm, aggregateSchedule, assessQuality, explainEvmRows, explainScheduleRows,
  summaryRows, taskRows, toCsv, type HoursTask, type ScheduleTask, type WorkItem,
} from '../src';

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', 3]])).toBe('"a,b","say ""hi""","x\ny",3\r\n');
  });
  it('defuses text a spreadsheet could run as a formula, but not numbers', () => {
    expect(toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)', -6]])).toBe(
      `"'=HYPERLINK(""http://x"")",'+1,'-2,'@SUM(A1),-6\r\n`,
    );
  });
  it('writes blanks for missing values', () => {
    expect(toCsv([['a', null, 'c']])).toBe('a,,c\r\n');
  });
});

describe('summary and task rows', () => {
  const hours: HoursTask[] = [
    { id: 'Design', plannedHours: 40, actualHours: 44, percentComplete: 100 },
    { id: '=evil', plannedHours: 80, actualHours: 30, percentComplete: 50 },
    { id: 'Docs', plannedHours: 16, actualHours: null, percentComplete: 0 },
  ];
  const sched: ScheduleTask[] = [
    { id: 'Design', plannedHours: 40, percentComplete: 100, plannedStart: '2026-01-05', plannedFinish: '2026-01-09' },
    { id: '=evil', plannedHours: 80, percentComplete: 50, plannedStart: '2026-01-12', plannedFinish: '2026-01-23' },
    { id: 'Docs', plannedHours: 16, percentComplete: 0, plannedStart: null, plannedFinish: null },
  ];
  const evm = aggregateHoursEvm(hours);
  const schedule = aggregateSchedule(sched, '2026-01-21', 'weekdays');
  const quality = assessQuality([] as WorkItem[], hours, evm);
  const rows = summaryRows({
    fileName: 'x.csv', toolName: 'Microsoft Project table export', generatedOn: '2026-10-15', statusDate: '2026-01-21',
    assumptions: ['Progress rule: tool reported.'], evm, schedule, quality,
  });
  const find = (item: string) => rows.find((r) => r[1] === item);

  it('carries the headline numbers (hand-checked: EV 80, AC 74, CPI 1.0811, PV 104, SPI 0.7692)', () => {
    expect(find('Earned value (EV)')?.[2]).toBe(80);
    expect(find('Actual cost (AC)')?.[2]).toBe(74);
    expect(find('Cost performance index (CPI)')?.[2]).toBe(1.0811);
    expect(find('Cost variance (CV)')?.[2]).toBe(6);
    expect(find('Planned value (PV)')?.[2]).toBe(104);
    expect(find('Schedule performance index (SPI)')?.[2]).toBe(0.7692);
    expect(find('Schedule variance (SV)')?.[2]).toBe(-24);
  });
  it('lists the assumptions and the source so the numbers can be traced', () => {
    expect(rows.some((r) => r[0] === 'Assumption')).toBe(true);
    expect(find('Status date')?.[2]).toBe('2026-01-21');
  });
  it('task rows line up with the explanations and sum to the headline numbers', () => {
    const t = taskRows(explainEvmRows(hours), explainScheduleRows(sched, '2026-01-21', 'weekdays'));
    expect(t[0]?.length).toBe(13);
    expect(t).toHaveLength(4);
    const sum = (col: number) => t.slice(1).reduce((s, r) => s + (typeof r[col] === 'number' ? (r[col] as number) : 0), 0);
    expect(sum(4)).toBeCloseTo(80);
    expect(sum(5)).toBeCloseTo(74);
    expect(sum(10)).toBeCloseTo(104);
    expect(toCsv(t)).toContain("'=evil");
  });
  it('says so when nothing could be computed', () => {
    const none = summaryRows({
      fileName: 'x', toolName: null, generatedOn: '2026-10-15', statusDate: null, assumptions: [],
      evm: aggregateHoursEvm([]), schedule: null, quality: null,
    });
    expect(none.find((r) => r[0] === 'Cost')?.[2]).toBe('Not available');
  });
});
