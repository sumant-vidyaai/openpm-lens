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
    const items = buildWorkItems(['n', 'e'], [['x', '7200']], { id: null, name: 'n', status: null, planned: 'e', actual: null, percent: null },
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
