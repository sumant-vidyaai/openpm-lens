import { describe, expect, it } from 'vitest';
import {
  aggregateSchedule, buildWorkItems, countDays, distinctStatuses, parseCsv, parseDateText, plannedFraction,
  suggestMapping, suggestStatusCategory, toScheduleTasks, type StatusMap,
} from '../src';

describe('parseDateText', () => {
  it('reads unambiguous formats', () => {
    expect(parseDateText('2026-03-04').iso).toBe('2026-03-04');
    expect(parseDateText('2026-03-04T08:00:00Z').iso).toBe('2026-03-04');
    expect(parseDateText('4 Mar 2026').iso).toBe('2026-03-04');
    expect(parseDateText('March 4, 2026').iso).toBe('2026-03-04');
    expect(parseDateText('Mon 5 Jan 26').iso).toBe('2026-01-05');
  });
  it('refuses 03/04/2026 unless the order is known', () => {
    const r = parseDateText('03/04/2026');
    expect(r.iso).toBeNull();
    expect(r.issue?.code).toBe('ambiguous_date');
    expect(parseDateText('03/04/2026', 'dmy').iso).toBe('2026-04-03');
    expect(parseDateText('03/04/2026', 'mdy').iso).toBe('2026-03-04');
  });
  it('accepts a slash date when one part is above 12, or both parts are equal', () => {
    expect(parseDateText('25/12/2026').iso).toBe('2026-12-25');
    expect(parseDateText('12/25/2026').iso).toBe('2026-12-25');
    expect(parseDateText('05/05/2026').iso).toBe('2026-05-05');
  });
  it('rejects impossible dates and leaves blanks blank', () => {
    expect(parseDateText('2026-02-30').iso).toBeNull();
    expect(parseDateText('').iso).toBeNull();
    expect(parseDateText('').issue).toBeNull();
    expect(parseDateText('soon').issue?.code).toBe('unparseable');
  });
});

describe('counting days and planned fraction', () => {
  it('counts weekdays and calendar days inclusively', () => {
    expect(countDays('2026-01-05', '2026-01-09', 'weekdays')).toBe(5); // Mon-Fri
    expect(countDays('2026-01-12', '2026-01-23', 'weekdays')).toBe(10);
    expect(countDays('2026-01-12', '2026-01-23', 'calendar')).toBe(12);
    expect(countDays('2026-01-10', '2026-01-11', 'weekdays')).toBe(0); // Sat-Sun
  });
  it('spreads evenly, and is 0 before the start and 1 after the finish', () => {
    expect(plannedFraction('2026-01-01', '2026-01-10', '2026-01-05', 'calendar')).toBeCloseTo(0.5);
    expect(plannedFraction('2026-01-12', '2026-01-23', '2026-01-09', 'weekdays')).toBe(0);
    expect(plannedFraction('2026-01-12', '2026-01-23', '2026-02-01', 'weekdays')).toBe(1);
  });
});

describe('SPI and SV (hand-checked)', () => {
  const csv = parseCsv([
    'ID,Name,Start,Finish,Baseline Work,% Complete',
    '1,Design,2026-01-05,2026-01-09,40 hrs,100%',
    '2,Build,2026-01-12,2026-01-23,80 hrs,50%',
    '3,Test,2026-01-26,2026-01-28,24 hrs,0%',
  ].join('\n'));
  const mapping = { ...suggestMapping(csv.headers), planned: 'Baseline Work', start: 'Start', finish: 'Finish', percent: '% Complete' };
  const statusMap: StatusMap = Object.fromEntries(distinctStatuses(csv.headers, csv.rows, mapping).map((s) => [s, suggestStatusCategory(s)]));
  const items = buildWorkItems(csv.headers, csv.rows, mapping, { defaultUnit: 'hours', percentScale: '0-100', statusMap });
  const tasks = toScheduleTasks(items, { hoursPerDay: 8, daysPerWeek: 5 }, 'tool_reported');

  it('on Fri 16 Jan: Design done (PV 40), Build 5 of 10 days (PV 40), Test not started (PV 0)', () => {
    const a = aggregateSchedule(tasks, '2026-01-16', 'weekdays');
    expect(a.pv).toBeCloseTo(80);
    expect(a.ev).toBeCloseTo(80); // 40 + 40 + 0
    expect(a.spi).toBeCloseTo(1);
    expect(a.sv).toBeCloseTo(0);
  });
  it('on Wed 21 Jan: Build is 8 of 10 days, PV 64 + 40 = 104, so SPI 0.769 and SV -24', () => {
    const a = aggregateSchedule(tasks, '2026-01-21', 'weekdays');
    expect(a.pv).toBeCloseTo(104);
    expect(a.spi).toBeCloseTo(80 / 104);
    expect(a.sv).toBeCloseTo(-24);
    expect(a.caveats.join(' ')).toContain('Monday to Friday');
  });
  it('before anything is planned, SPI is not a number (PV is 0) rather than a made-up one', () => {
    const a = aggregateSchedule(tasks, '2026-01-01', 'weekdays');
    expect(a.pv).toBe(0);
    expect(a.spi).toBeNull();
  });
  it('excludes tasks with missing dates or finish before start, and says why', () => {
    const a = aggregateSchedule(
      [
        { id: 'a', plannedHours: 10, percentComplete: 50, plannedStart: '2026-01-01', plannedFinish: '2026-01-10' },
        { id: 'b', plannedHours: 10, percentComplete: 50, plannedStart: null, plannedFinish: null },
        { id: 'c', plannedHours: 10, percentComplete: 50, plannedStart: '2026-01-10', plannedFinish: '2026-01-01' },
        { id: 'd', plannedHours: null, percentComplete: 50, plannedStart: '2026-01-01', plannedFinish: '2026-01-10' },
      ],
      '2026-01-05', 'calendar',
    );
    expect(a.counts).toEqual({ total: 4, used: 1, excluded: 3 });
    expect(a.pv).toBeCloseTo(5);
    expect(a.ev).toBeCloseTo(5);
    expect(a.spi).toBeCloseTo(1);
  });
  it('is not available when no task has dates', () => {
    const a = aggregateSchedule([{ id: 'x', plannedHours: 5, percentComplete: 10, plannedStart: null, plannedFinish: null }], '2026-01-05', 'calendar');
    expect(a.status).toBe('not_available');
    expect(a.missing).toContain('plannedDates');
  });
});
