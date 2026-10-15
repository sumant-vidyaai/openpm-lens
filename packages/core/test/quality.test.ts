import { describe, expect, it } from 'vitest';
import {
  TABLE_ADAPTERS, aggregateHoursEvm, assessQuality, buildWorkItems, coverageMatrix, distinctStatuses,
  parseCsv, suggestMapping, suggestStatusCategory, toHoursTasks, type StatusMap,
} from '../src';

function run(csvText: string) {
  const csv = parseCsv(csvText);
  const mapping = suggestMapping(csv.headers);
  const statusMap: StatusMap = Object.fromEntries(
    distinctStatuses(csv.headers, csv.rows, mapping).map((s) => [s, suggestStatusCategory(s)]),
  );
  const items = buildWorkItems(csv.headers, csv.rows, mapping, { defaultUnit: 'hours', percentScale: '0-100', statusMap });
  const tasks = toHoursTasks(items, { hoursPerDay: 8, daysPerWeek: 5 }, 'tool_reported');
  return { items, tasks, agg: aggregateHoursEvm(tasks) };
}

const SIX = [
  'Task,Status,Estimate (h),Actual (h),% Complete',
  'a,Done,40,46,100', 'b,In Progress,60,30,50', 'c,In Progress,80,20,25',
  'd,To Do,16,,0', 'e,Done,,12,100', 'f,Waiting on legal,24,,',
].join('\n');

describe('assessQuality', () => {
  it('scores the share of usable tasks (hand-checked: 3 of 6 = 50)', () => {
    const { items, tasks, agg } = run(SIX);
    const q = assessQuality(items, tasks, agg);
    expect(q.status).toBe('scored');
    expect(q.score).toBe(50);
    expect([q.usable, q.total]).toEqual([3, 6]);
    // planned known on 5 of 6, actual on 4 of 6, progress on 5 of 6 (task f has no %)
    expect(q.fields.map((f) => f.present)).toEqual([5, 4, 5]);
    expect(q.reading).toContain('not a standard');
  });
  it('withholds the score when there are too few tasks', () => {
    const { items, tasks, agg } = run('Task,Estimate (h),Actual (h),% Complete\na,10,10,100\nb,10,5,50');
    const q = assessQuality(items, tasks, agg);
    expect(q.status).toBe('insufficient_data');
    expect(q.score).toBeNull();
    expect(q.reading).toContain('Insufficient data');
  });
  it('handles an empty file', () => {
    const { items, tasks, agg } = run('Task,Estimate (h),Actual (h),% Complete');
    expect(assessQuality(items, tasks, agg).status).toBe('no_tasks');
  });
  it('counts reading problems', () => {
    const { items, tasks, agg } = run('Task,Estimate (h),Actual (h),% Complete\na,1,1,140\nb,1,1,150\nc,1,1,10\nd,1,1,10\ne,1,1,10');
    const q = assessQuality(items, tasks, agg);
    expect(q.issueCounts).toEqual([{ code: 'percent_out_of_range', count: 2 }]);
  });
});

describe('coverage matrix', () => {
  const rows = coverageMatrix();
  const col = (id: string) => TABLE_ADAPTERS.findIndex((a) => a.id === id);
  const row = (label: string) => rows.find((r) => r.label.startsWith(label))!;
  it('has one cell per tool in every row', () => {
    for (const r of rows) expect(r.cells).toHaveLength(TABLE_ADAPTERS.length);
  });
  it('reflects what each tool really provides', () => {
    expect(row('Earned value').cells[col('linear-csv')]).toBe('no');
    expect(row('Earned value').cells[col('jira-csv')]).toBe('yes');
    expect(row('Earned value').cells[col('clickup-csv')]).toBe('check');
    expect(row('Reports its own').cells[col('ms-project-table')]).toBe('yes');
    expect(row('Reports its own').cells[col('jira-csv')]).toBe('no');
    expect(row('Actual effort').cells[col('linear-csv')]).toBe('no');
    expect(row('Schedule performance').cells.every((c) => c === 'no')).toBe(true);
  });
});
