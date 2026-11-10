import { describe, expect, it } from 'vitest';
import {
  aggregateHoursEvm, buildWorkItems, distinctStatuses, parseCsv, suggestMapping,
  suggestStatusCategory, toHoursTasks, type ImportOptions, type StatusMap,
} from '../src';

const SAMPLE = [
  'Task,Status,Estimate (h),Actual (h),% Complete',
  'A,Done,10,12,100',
  'B,In Progress,20,8,40%',
  'C,To Do,10,,0',
  'D,Done,,5,100',
].join('\r\n');

describe('parseCsv', () => {
  it('reads headers and rows', () => {
    const r = parseCsv(SAMPLE);
    expect(r.delimiter).toBe(',');
    expect(r.headers).toEqual(['Task', 'Status', 'Estimate (h)', 'Actual (h)', '% Complete']);
    expect(r.rows).toHaveLength(4);
  });
  it('handles quotes, escaped quotes, commas and line breaks inside cells', () => {
    const r = parseCsv('a,b\n"x, ""y""","line1\nline2"\n');
    expect(r.rows).toEqual([['x, "y"', 'line1\nline2']]);
  });
  it('detects semicolons and tabs, and strips a byte-order mark', () => {
    expect(parseCsv('﻿a;b\n1;2').delimiter).toBe(';');
    expect(parseCsv('a\tb\n1\t2').headers).toEqual(['a', 'b']);
    expect(parseCsv('﻿a,b\n1,2').headers[0]).toBe('a');
  });
  it('names blank headers, pads short rows and warns', () => {
    const r = parseCsv('a,,c\n1,2\n');
    expect(r.headers).toEqual(['a', 'Column 2', 'c']);
    expect(r.rows[0]).toEqual(['1', '2', '']);
    expect(r.warnings.join(' ')).toContain('different number of cells');
  });
});

describe('mapping suggestions', () => {
  it('guesses the columns from header wording', () => {
    const m = suggestMapping(parseCsv(SAMPLE).headers);
    expect(m).toMatchObject({ name: 'Task', status: 'Status', planned: 'Estimate (h)', actual: 'Actual (h)', percent: '% Complete', id: null });
  });
  it('leaves unclear statuses for the user', () => {
    expect(suggestStatusCategory('Done')).toBe('done');
    expect(suggestStatusCategory('In Progress')).toBe('in_progress');
    expect(suggestStatusCategory('To Do')).toBe('not_started');
    expect(suggestStatusCategory('Cancelled')).toBe('cancelled');
    expect(suggestStatusCategory('Waiting on legal')).toBe('unmapped');
  });
});

describe('import to EVM (hand-checked)', () => {
  const csv = parseCsv(SAMPLE);
  const mapping = suggestMapping(csv.headers);
  const statusMap: StatusMap = Object.fromEntries(
    distinctStatuses(csv.headers, csv.rows, mapping).map((s) => [s, suggestStatusCategory(s)]),
  );
  const options: ImportOptions = { defaultUnit: 'hours', percentScale: '0-100', statusMap };
  const items = buildWorkItems(csv.headers, csv.rows, mapping, options);
  const calendar = { hoursPerDay: 8, daysPerWeek: 5 };

  it('keeps blanks as missing, never zero', () => {
    expect(items[2]?.actual.value).toBeNull();
    expect(items[3]?.estimate.value).toBeNull();
  });

  it('computes EV, AC, BAC with the missing-data rule shown', () => {
    const agg = aggregateHoursEvm(toHoursTasks(items, calendar, 'tool_reported'));
    // A: EV 10, AC 12. B: EV 20 x 40% = 8, AC 8. C has no actual, D has no planned: both excluded.
    expect(agg.ev).toBeCloseTo(18);
    expect(agg.ac).toBeCloseTo(20);
    expect(agg.bac).toBeCloseTo(30);
    expect(agg.status).toBe('computed_with_caveats');
    expect(agg.counts).toMatchObject({ total: 4, used: 2, excluded: 2 });
  });

  it('reads 0-1 percentages only when the user says so', () => {
    const o: ImportOptions = { ...options, percentScale: '0-1' };
    const it2 = buildWorkItems(['T', 'P'], [['x', '0.4'], ['y', '40%']], { id: null, name: 'T', status: null, planned: null, actual: null, percent: 'P', start: null, finish: null }, o);
    expect(it2[0]?.percentCompleteReported).toBeCloseTo(40);
    expect(it2[1]?.percentCompleteReported).toBe(40);
  });

  it('refuses a percentage outside 0-100 and flags it', () => {
    const it3 = buildWorkItems(['T', 'P'], [['x', '140']], { id: null, name: 'T', status: null, planned: null, actual: null, percent: 'P', start: null, finish: null }, options);
    expect(it3[0]?.percentCompleteReported).toBeNull();
    expect(it3[0]?.issues[0]?.code).toBe('percent_out_of_range');
  });
});

import { tableFromGrid } from '../src';
describe('tableFromGrid (spreadsheet sheets)', () => {
  it('converts cells to text, keeping blanks blank and dropping empty rows', () => {
    const t = tableFromGrid([
      ['Task', 'Estimate', 'Done?', 'Due'],
      ['A', 8.5, true, new Date('2026-03-01T00:00:00Z')],
      [null, null, null, null],
      ['B', null, false, null],
    ]);
    expect(t.headers).toEqual(['Task', 'Estimate', 'Done?', 'Due']);
    expect(t.rows).toEqual([['A', '8.5', 'TRUE', '2026-03-01'], ['B', '', 'FALSE', '']]);
  });
});
