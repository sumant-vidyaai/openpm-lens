import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_COLUMNS, isTemplateTable, parseTemplateSettings, parseTemplateRates, templateReadiness,
  detectTableAdapter, suggestFlowColumns,
} from '../src';

describe('template recognition', () => {
  it('recognises the template headers and sets the mapping with no guessing', () => {
    const h = [...TEMPLATE_COLUMNS] as string[];
    expect(isTemplateTable(h)).toBe(true);
    const a = detectTableAdapter(h);
    expect(a?.id).toBe('openpm-lens-template');
    const s = a!.suggest(h);
    expect(s.mapping.planned).toBe('Estimate (h)');
    expect(s.mapping.actual).toBe('Actual (h)');
    expect(s.mapping.percent).toBe('% complete');
    expect(s.mapping.start).toBe('Planned start');
    expect(s.defaultUnit).toBe('hours');
    expect(s.notes.join(' ')).not.toMatch(/not confirmed/);
  });
  it('does not claim an ordinary file', () => {
    expect(isTemplateTable(['Task', 'Status', 'Hours'])).toBe(false);
  });
  it('flow guesser uses Actual start / Actual finish, not Resolved', () => {
    const c = suggestFlowColumns([...TEMPLATE_COLUMNS, 'Resolved'] as string[]);
    expect(c.start).toBe('Actual start');
    expect(c.done).toBe('Actual finish');
  });
});

describe('settings', () => {
  it('reads valid values and reports invalid ones without guessing', () => {
    const s = parseTemplateSettings([
      ['Setting', 'Value'],
      ['Status date', new Date(Date.UTC(2026, 2, 31))],
      ['Hours per working day', 7.5],
      ['Days counted', 'All days'],
      ['Weekly capacity (h)', '37.5'],
      ['Currency', 'INR'],
      ['Default hourly rate', 'abc'],
      ['Green from', 0.9],
      ['Amber from', 0.8],
      ['Progress rule', '50/50'],
    ]);
    expect(s.statusDate).toBe('2026-03-31');
    expect(s.hoursPerDay).toBe(7.5);
    expect(s.dayCount).toBe('calendar');
    expect(s.capacity).toBe(37.5);
    expect(s.currency).toBe('INR');
    expect(s.defaultRate).toBeNull();
    expect(s.greenMin).toBe(0.9);
    expect(s.amberMin).toBe(0.8);
    expect(s.rule).toBe('fifty_fifty');
    expect(s.problems.length).toBe(1);
  });
  it('rejects amber >= green', () => {
    const s = parseTemplateSettings([['Green from', 0.8], ['Amber from', 0.9]]);
    expect(s.greenMin).toBeNull();
    expect(s.problems.length).toBe(1);
  });
  it('blank settings stay null (never 0)', () => {
    const s = parseTemplateSettings([['Status date', null], ['Hours per working day', null]]);
    expect(s.statusDate).toBeNull();
    expect(s.hoursPerDay).toBeNull();
    expect(s.problems).toEqual([]);
  });
});

describe('rates and readiness', () => {
  it('reads rates and flags bad rows', () => {
    const r = parseTemplateRates([['Person', 'Hourly rate'], ['Asha', 50], ['Ravi', 'x'], [null, null]]);
    expect(r.rates).toEqual({ Asha: 50 });
    expect(r.problems.length).toBe(1);
  });
  it('counts rows that have what each metric needs; blank is missing', () => {
    const h = [...TEMPLATE_COLUMNS] as string[];
    const row = (o: Record<string, string>) => h.map((c) => o[c] ?? '');
    const rows = [
      row({ 'Estimate (h)': '10', 'Actual (h)': '12', '% complete': '100' }),
      row({ 'Estimate (h)': '10', 'Actual (h)': '', '% complete': '50' }),
      row({ 'Estimate (h)': '10', 'Actual (h)': '0', '% complete': '0' }),
    ];
    rows.push(row({ Status: 'Cancelled', 'Estimate (h)': '5', 'Actual (h)': '0', '% complete': '0' }));
    const r = templateReadiness(h, rows);
    expect(r.total).toBe(3);
    expect(r.cancelled).toBe(1);
    expect(r.checks[0]?.ready).toBe(2); // "0" is a real value; blank is not
    expect(r.checks[1]?.ready).toBe(0); // no dates
  });
});

import { readFileSync } from 'node:fs';
import { parseCsv } from '../src';
describe('shipped template files', () => {
  it('the CSV headers equal TEMPLATE_COLUMNS, and the example is recognised', () => {
    const dir = new URL('../../web/public/templates/', import.meta.url);
    const blank = parseCsv(readFileSync(new URL('openpm-lens-template.csv', dir), 'utf8'));
    expect(blank.headers).toEqual([...TEMPLATE_COLUMNS]);
    const ex = parseCsv(readFileSync(new URL('openpm-lens-example.csv', dir), 'utf8'));
    expect(isTemplateTable(ex.headers)).toBe(true);
    expect(ex.rows.length).toBe(14);
  });
});
