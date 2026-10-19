import { describe, expect, it } from 'vitest';
import {
  countDays, plannedFraction, aggregateSchedule, analyseResources, plannedValueCurve, earnedSchedule,
  parseTemplateHolidays, parseTemplateLeave, extractTemplate, type ScheduleTask,
} from '../src';

// Week of Monday 2026-03-23 to Friday 2026-03-27. 2026-03-28 is a Saturday.
describe('holidays in day counts', () => {
  it('a weekday holiday is not counted; a weekend holiday changes nothing', () => {
    expect(countDays('2026-03-23', '2026-03-27', 'weekdays')).toBe(5);
    expect(countDays('2026-03-23', '2026-03-27', { mode: 'weekdays', holidays: ['2026-03-25'] })).toBe(4);
    expect(countDays('2026-03-23', '2026-03-29', { mode: 'weekdays', holidays: ['2026-03-28'] })).toBe(5);
  });
  it('calendar mode counts every day, holidays included', () => {
    expect(countDays('2026-03-23', '2026-03-27', { mode: 'calendar', holidays: ['2026-03-25'] })).toBe(5);
  });
  it('planned fraction: 3 of 5 days without the holiday, 2 of 4 with it', () => {
    expect(plannedFraction('2026-03-23', '2026-03-27', '2026-03-25', 'weekdays')).toBeCloseTo(0.6, 10);
    expect(plannedFraction('2026-03-23', '2026-03-27', '2026-03-25', { mode: 'weekdays', holidays: ['2026-03-25'] })).toBeCloseTo(0.5, 10);
  });
  it('planned value uses the holiday and says so', () => {
    const t: ScheduleTask[] = [{ id: 'a', plannedHours: 40, percentComplete: 50, plannedStart: '2026-03-23', plannedFinish: '2026-03-27' }];
    const plain = aggregateSchedule(t, '2026-03-25', 'weekdays');
    const hol = aggregateSchedule(t, '2026-03-25', { mode: 'weekdays', holidays: ['2026-03-25'] });
    expect(plain.pv).toBeCloseTo(24, 10);
    expect(hol.pv).toBeCloseTo(20, 10);
    expect(hol.caveats.join(' ')).toMatch(/1 holiday/);
    const curve = plannedValueCurve(t, { mode: 'weekdays', holidays: ['2026-03-25'] });
    expect(curve.dates).toEqual(['2026-03-23', '2026-03-24', '2026-03-26', '2026-03-27']);
    expect(curve.pv).toEqual([10, 20, 30, 40]);
    expect(earnedSchedule(t, '2026-03-25', { mode: 'weekdays', holidays: ['2026-03-25'] }).status).toBe('computed');
  });
});

describe('capacity with holidays and leave', () => {
  const task = [{ id: 'a', assignee: 'Asha', plannedHours: 40, actualHours: null, plannedStart: '2026-03-23', plannedFinish: '2026-03-27' }];
  const base = { capacityDefault: 40, capacityByPerson: {}, overPercent: 100 };
  const wk = (r: ReturnType<typeof analyseResources>) => r.people[0]!.weeks[0]!;
  it('no holiday or leave: 40 / 40 = 100%', () => {
    expect(wk(analyseResources(task, { ...base, mode: 'weekdays' })).utilisation).toBeCloseTo(100, 8);
  });
  it('one holiday: capacity 32, load still 40, so 125%', () => {
    const w = wk(analyseResources(task, { ...base, mode: { mode: 'weekdays', holidays: ['2026-03-25'] } }));
    expect(w.capacity).toBeCloseTo(32, 10);
    expect(w.utilisation).toBeCloseTo(125, 8);
  });
  it('holiday plus two leave days: capacity 16, 250%', () => {
    const r = analyseResources(task, { ...base, mode: { mode: 'weekdays', holidays: ['2026-03-25'] }, leave: [{ person: 'asha', from: '2026-03-26', to: '2026-03-27' }] });
    expect(wk(r).capacity).toBeCloseTo(16, 10);
    expect(wk(r).utilisation).toBeCloseTo(250, 8);
    expect(r.caveats.join(' ')).toMatch(/Leave: 1 leave entry/);
  });
  it('a week fully away with work planned counts as over the limit, with no ratio', () => {
    const r = analyseResources(task, { ...base, mode: 'weekdays', leave: [{ person: 'Asha', from: '2026-03-23', to: '2026-03-27' }] });
    expect(wk(r).capacity).toBe(0);
    expect(wk(r).utilisation).toBeNull();
    expect(r.people[0]!.overWeeks).toBe(1);
  });
  it('leave for someone else changes nothing', () => {
    const r = analyseResources(task, { ...base, mode: 'weekdays', leave: [{ person: 'Ravi', from: '2026-03-23', to: '2026-03-27' }] });
    expect(wk(r).utilisation).toBeCloseTo(100, 8);
  });
});

describe('Holidays and Leave sheets', () => {
  it('reads dates (including real date cells), lists unclear ones', () => {
    const h = parseTemplateHolidays([['Date', 'Name'], [new Date(Date.UTC(2026, 2, 25)), 'Fest'], ['2026-04-03', ''], ['04/05/26', 'x'], [null, null]]);
    expect(h.dates).toEqual(['2026-03-25', '2026-04-03']);
    expect(h.problems.length).toBe(1);
  });
  it('leave: blank "to" is one day; bad rows are listed', () => {
    const l = parseTemplateLeave([['Person', 'From', 'To'], ['Asha', '2026-03-26', ''], ['Ravi', '2026-03-30', '2026-03-27'], ['', '2026-03-30', '2026-03-31']]);
    expect(l.entries).toEqual([{ person: 'Asha', from: '2026-03-26', to: '2026-03-26' }]);
    expect(l.problems.length).toBe(2);
  });
  it('extractTemplate picks the sheets up by name', () => {
    const p = extractTemplate([{ name: 'Tasks', data: [] }, { name: 'Holidays', data: [['Date'], ['2026-03-25']] }, { name: 'Leave', data: [['Person'], ['A', '2026-03-26']] }])!;
    expect(p.holidays.dates).toEqual(['2026-03-25']);
    expect(p.leave.entries.length).toBe(1);
  });
});

import { parseHolidayText } from '../src';
describe('typed holidays', () => {
  it('splits on lines, commas and semicolons; lists unclear dates', () => {
    const h = parseHolidayText('2026-03-25\n2026-04-03, 2026-04-03; 05/06/26\n');
    expect(h.dates).toEqual(['2026-03-25', '2026-04-03']);
    expect(h.problems.length).toBe(1);
  });
});
