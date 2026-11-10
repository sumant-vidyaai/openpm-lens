import { describe, expect, it } from 'vitest';
import {
  aggregateHoursEvm, buildWorkItems, detectTableAdapter, distinctStatuses, parseCsv,
  parseQuantity, suggestStatusCategory, toHoursTasks, type StatusMap,
} from '../src';

// Synthetic file imitating a Jira export's column layout. Not real data.
const JIRA = [
  'Summary,Issue key,Issue id,Issue Type,Status,Status Category,Original estimate,Time Spent,Σ Original Estimate,Σ Time Spent',
  'Login page,DEMO-1,10001,Story,Done,Done,28800,32400,28800,32400',
  'Reports,DEMO-2,10002,Story,In Progress,In Progress,57600,14400,57600,14400',
  'Docs,DEMO-3,10003,Task,To Do,To Do,28800,,28800,',
].join('\n');

describe('seconds', () => {
  it('parses a unit-less number as seconds when told, and converts to hours', () => {
    const q = parseQuantity('28800', { defaultUnit: 'seconds' });
    expect(q.unit).toBe('seconds');
    const items = buildWorkItems(['n', 'e'], [['x', '7200']], { id: null, name: 'n', status: null, planned: 'e', actual: null, percent: null, start: null, finish: null },
      { defaultUnit: 'seconds', percentScale: '0-100', statusMap: {} });
    expect(toHoursTasks(items, { hoursPerDay: 8, daysPerWeek: 5 }, 'zero_hundred')[0]?.plannedHours).toBeCloseTo(2);
  });
});

describe('Jira table adapter', () => {
  const csv = parseCsv(JIRA);
  const adapter = detectTableAdapter(csv.headers);

  it('recognises the file and does not trigger on a generic one', () => {
    expect(adapter?.id).toBe('jira-csv');
    expect(detectTableAdapter(['Task', 'Estimate', 'Actual'])).toBeNull();
  });

  it('maps columns, skipping the sum columns, and reports its limits', () => {
    const s = (adapter as NonNullable<typeof adapter>).suggest(csv.headers);
    expect(s.mapping).toMatchObject({
      name: 'Summary', id: 'Issue key', status: 'Status Category',
      planned: 'Original estimate', actual: 'Time Spent', percent: null,
    });
    expect(s.defaultUnit).toBe('seconds');
    expect(s.suggestedRule).toBe('zero_hundred');
    expect(s.notes.join(' ')).toContain('no % complete');
  });

  it('gives hand-checked results: Done=100%, In Progress=0% under 0/100', () => {
    const s = (adapter as NonNullable<typeof adapter>).suggest(csv.headers);
    const statusMap: StatusMap = Object.fromEntries(
      distinctStatuses(csv.headers, csv.rows, s.mapping).map((v) => [v, suggestStatusCategory(v)]),
    );
    const items = buildWorkItems(csv.headers, csv.rows, s.mapping, { defaultUnit: 'seconds', percentScale: '0-100', statusMap });
    const agg = aggregateHoursEvm(toHoursTasks(items, { hoursPerDay: 8, daysPerWeek: 5 }, 'zero_hundred'));
    // DEMO-1: planned 8h, done, actual 9h -> EV 8, AC 9.
    // DEMO-2: planned 16h, in progress (0% under 0/100), actual 4h -> EV 0, AC 4.
    // DEMO-3: no time spent -> excluded.
    expect(agg.ev).toBeCloseTo(8);
    expect(agg.ac).toBeCloseTo(13);
    expect(agg.bac).toBeCloseTo(24);
    expect(agg.counts).toMatchObject({ total: 3, used: 2, excluded: 1 });
  });
});

import { TABLE_ADAPTERS } from '../src';
// Synthetic headers only, imitating each tool's documented export layout. No real data.
const CASES: [string, string[]][] = [
  ['azure-devops-csv', ['ID', 'Work Item Type', 'Title', 'Assigned To', 'State', 'Original Estimate', 'Completed Work']],
  ['linear-csv', ['ID', 'Team', 'Title', 'Description', 'Status', 'Estimate', 'Priority', 'Created', 'Started', 'Completed']],
  ['clickup-csv', ['Task ID', 'Task Name', 'Status', 'Time Estimated', 'Time Estimated Text', 'Time Spent', 'Time Spent Text']],
  ['workfront-export', ['Name', 'Status', 'Planned Hours', 'Actual Hours', 'Percent Complete']],
  ['ms-project-table', ['ID', 'Name', 'Duration', 'Start', 'Finish', 'Work', 'Baseline Work', 'Actual Work', '% Complete']],
  ['jira-csv', ['Summary', 'Issue key', 'Issue Type', 'Status']],
];
describe('all table adapters', () => {
  it.each(CASES)('%s is recognised by its own headers and by no other adapter', (id, headers) => {
    const matches = TABLE_ADAPTERS.filter((a) => a.detect(headers).matches).map((a) => a.id);
    expect(matches).toEqual([id]);
    expect(detectTableAdapter(headers)?.id).toBe(id);
  });
  it('maps the right columns for each tool', () => {
    const by = Object.fromEntries(CASES);
    const s = (id: string) => (TABLE_ADAPTERS.find((a) => a.id === id) as NonNullable<unknown> as (typeof TABLE_ADAPTERS)[number]).suggest(by[id] as string[]).mapping;
    expect(s('azure-devops-csv')).toMatchObject({ name: 'Title', status: 'State', planned: 'Original Estimate', actual: 'Completed Work' });
    expect(s('linear-csv')).toMatchObject({ name: 'Title', planned: 'Estimate', actual: null });
    expect(s('clickup-csv')).toMatchObject({ planned: 'Time Estimated', actual: 'Time Spent' });
    expect(s('workfront-export')).toMatchObject({ planned: 'Planned Hours', actual: 'Actual Hours', percent: 'Percent Complete' });
    expect(s('ms-project-table')).toMatchObject({ planned: 'Baseline Work', actual: 'Actual Work', percent: '% Complete' });
  });
  it('does not claim a generic file', () => {
    expect(detectTableAdapter(['Task', 'Status', 'Estimate (h)', 'Actual (h)', '% Complete'])).toBeNull();
  });
  it('reads Project-style cells with units in them', () => {
    const q = parseQuantity('120 hrs', { field: 'x' });
    expect([q.value, q.unit]).toEqual([120, 'hours']);
    // A thousands comma is refused on purpose: "1,200" could also be read as 1.2 in some regions.
    const big = parseQuantity('1,200 hrs', { field: 'x' });
    expect(big.value).toBeNull();
    expect(big.issues[0]?.code).toBe('ambiguous_decimal');
    expect(parseQuantity('5 days').unit).toBe('days');
    expect(parseQuantity('30 mins').unit).toBe('minutes');
  });
  it('treats Removed as cancelled', () => {
    expect(suggestStatusCategory('Removed')).toBe('cancelled');
    expect(suggestStatusCategory('Active')).toBe('in_progress');
    expect(suggestStatusCategory('Resolved')).toBe('done');
  });
});
