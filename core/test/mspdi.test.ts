import { describe, expect, it } from 'vitest';
import { parseMspdi, parseMspdiDate, parseWorkHours } from '../src/mspdi';
import { buildWorkItems, toHoursTasks } from '../src/importTasks';

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
 <Tasks>
  <Task><UID>0</UID><ID>0</ID><Name>Whole plan</Name><Summary>1</Summary><Work>PT999H0M0S</Work></Task>
  <Task><UID>1</UID><ID>1</ID><Name>Design &amp; build</Name><Summary>0</Summary><WBS>1.1</WBS>
    <Start>2026-01-12T08:00:00</Start><Finish>2026-01-16T17:00:00</Finish><Work>PT50H0M0S</Work><ActualWork>PT30H30M0S</ActualWork>
    <PercentComplete>40</PercentComplete><PercentWorkComplete>60</PercentWorkComplete>
    <Baseline><Number>0</Number><Start>2026-01-05T08:00:00</Start><Finish>2026-01-09T17:00:00</Finish><Work>PT40H0M0S</Work></Baseline>
    <Baseline><Number>1</Number><Work>PT99H0M0S</Work></Baseline></Task>
  <Task><UID>2</UID><ID>2</ID><Name>Test</Name><Summary>0</Summary><ActualFinish>2026-01-20T17:00:00</ActualFinish><PercentWorkComplete>100</PercentWorkComplete>
    <Baseline><Number>0</Number><Start>2026-01-12T08:00:00</Start><Finish>2026-01-16T17:00:00</Finish><Work>P1D</Work></Baseline></Task>
  <Task><UID>3</UID><ID>3</ID><Name>Review</Name><Summary>0</Summary></Task>
  <Task><UID>4</UID><ID>4</ID><Summary>0</Summary></Task>
 </Tasks>
 <Resources><Resource><UID>1</UID><Name>Ann</Name></Resource><Resource><UID>2</UID><Name>Bob</Name></Resource></Resources>
 <Assignments>
  <Assignment><TaskUID>1</TaskUID><ResourceUID>1</ResourceUID></Assignment>
  <Assignment><TaskUID>3</TaskUID><ResourceUID>1</ResourceUID></Assignment>
  <Assignment><TaskUID>3</TaskUID><ResourceUID>2</ResourceUID></Assignment>
  <Assignment><TaskUID>3</TaskUID><ResourceUID>9</ResourceUID></Assignment>
 </Assignments>
</Project>`;

describe('parseMspdi', () => {
  const r = parseMspdi(XML);
  const row = (i: number) => Object.fromEntries(r.table.headers.map((h, k) => [h, r.table.rows[i]?.[k]]));
  it('leaves out summary and unnamed tasks', () => {
    expect(r.table.rows).toHaveLength(3);
    expect(r.notes.join(' ')).toContain('1 summary task was left out');
    expect(r.notes.join(' ')).toContain('1 task has no name');
  });
  it('reads names with entities, baseline 0 values, durations and work percent', () => {
    expect(row(0)).toMatchObject({ ID: '1', WBS: '1.1', Name: 'Design & build', 'Estimate (h)': '40', 'Actual (h)': '30.5', '% Complete': '60', Start: '2026-01-05', Finish: '2026-01-09', Assignee: 'Ann' });
  });
  it('leaves an unreadable duration blank and says so', () => {
    expect(row(1)['Estimate (h)']).toBe('');
    expect(row(1)['Actual finish']).toBe('2026-01-20');
    expect(r.notes.join(' ')).toContain('1 work value was not in the documented');
  });
  it('lists several people with "; " and skips unknown resources', () => {
    expect(row(2).Assignee).toBe('Ann; Bob');
    expect(r.notes.join(' ')).toContain('not in the file');
  });
  it('states the baseline it used and the unconfirmed meaning', () => {
    expect(r.notes.join(' ')).toContain('baseline number 0');
    expect(r.notes.join(' ')).toContain('does not say what the baseline number means');
    expect(r.notes.join(' ')).toContain('more than one saved baseline');
    expect(r.notes.join(' ')).toContain('1 task has no values in that baseline');
  });
  it('flows through the importer: planned 40 h, actual 30.5 h, 60%', () => {
    const items = buildWorkItems(r.table.headers, r.table.rows, { id: 'ID', name: 'Name', status: null, planned: 'Estimate (h)', actual: 'Actual (h)', percent: '% Complete', start: 'Start', finish: 'Finish' }, { defaultUnit: 'hours', percentScale: '0-100', statusMap: {} });
    const t = toHoursTasks(items, { hoursPerDay: 8, daysPerWeek: 5 }, 'tool_reported');
    expect(t[0]).toMatchObject({ plannedHours: 40, actualHours: 30.5, percentComplete: 60 });
    expect(items[0]?.baselineStart).toBe('2026-01-05');
  });
});

describe('parseMspdi without a baseline', () => {
  it('uses the current schedule and says why that is weaker', () => {
    const r = parseMspdi('<Project><Tasks><Task><UID>1</UID><Name>A</Name><Work>PT8H0M0S</Work><Start>2026-02-02T08:00:00</Start><Finish>2026-02-02T17:00:00</Finish><PercentComplete>50</PercentComplete></Task></Tasks></Project>');
    expect(r.table.rows[0]).toEqual(['1', '', 'A', '8', '', '50', '2026-02-02', '2026-02-02', '', '']);
    expect(r.notes.join(' ')).toContain('no saved baseline');
    expect(r.notes.join(' ')).toContain('"% complete" (the share of the duration)');
  });
});

describe('safety and errors', () => {
  it('refuses DOCTYPE and ENTITY declarations', () => {
    expect(() => parseMspdi('<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "x">]><Project><Tasks/></Project>')).toThrow(/DOCTYPE or ENTITY/);
  });
  it('explains when it is not a Project file', () => {
    expect(() => parseMspdi('<Other/>')).toThrow(/no Project element/);
    expect(() => parseMspdi('not xml at all <<<')).toThrow();
  });
  it('reads documented durations and dates only', () => {
    expect(parseWorkHours('PT16H0M0S')).toBe(16);
    expect(parseWorkHours('PT1H30M0S')).toBeCloseTo(1.5);
    expect(parseWorkHours('P1D')).toBeNull();
    expect(parseWorkHours('PT')).toBeNull();
    expect(parseWorkHours('16')).toBeNull();
    expect(parseMspdiDate('2007-11-14T08:00:00')).toBe('2007-11-14');
    expect(parseMspdiDate('2026-02-30T08:00:00')).toBeNull();
    expect(parseMspdiDate('11/14/2007')).toBeNull();
  });
  it('an empty project gives an empty table, not an error', () => {
    expect(parseMspdi('<Project><Tasks/></Project>').table.rows).toHaveLength(0);
  });
});
