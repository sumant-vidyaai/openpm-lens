import { describe, expect, it } from 'vitest';
import { businessCase, goRecordGaps, gridQuadrant, scoreOptions, summariseSolicitations } from '../src';

describe('weighted scoring (worked example from a published guide)', () => {
  const crit = [{ name: 'Price', weight: 0.4 }, { name: 'Reputation', weight: 0.3 }, { name: 'Sustainability', weight: 0.3 }];
  const r = scoreOptions(crit, [
    { option: 'A', scores: { Price: 10, Reputation: 10, Sustainability: 5 } },
    { option: 'B', scores: { Price: 10, Reputation: 6, Sustainability: 10 } },
    { option: 'C', scores: { Price: 8.5, Reputation: 9, Sustainability: 10 } },
  ]);
  it('gives 8.5, 8.8 and 9.1 and ranks C, B, A', () => {
    expect(r.options.map((o) => +(o.score as number).toFixed(4))).toEqual([8.5, 8.8, 9.1]);
    expect(r.options.map((o) => o.rank)).toEqual([3, 2, 1]);
  });
  it('gives the same answer when weights are 40, 30, 30 instead of fractions', () => {
    const r2 = scoreOptions(crit.map((c) => ({ ...c, weight: (c.weight as number) * 100 })), [{ option: 'C', scores: { Price: 8.5, Reputation: 9, Sustainability: 10 } }]);
    expect(r2.options[0]?.score).toBeCloseTo(9.1, 9);
  });
  it('leaves an option unscored (not zero) when a score is missing, and names it', () => {
    const m = scoreOptions(crit, [{ option: 'X', scores: { Price: 5, Reputation: null } }]);
    expect(m.options[0]).toMatchObject({ score: null, rank: null, missing: ['Reputation', 'Sustainability'] });
  });
  it('ignores criteria with no weight and ties share a rank', () => {
    const t = scoreOptions([{ name: 'a', weight: 1 }, { name: 'b', weight: null }], [{ option: 'p', scores: { a: 3 } }, { option: 'q', scores: { a: 3 } }]);
    expect(t.ignored).toEqual(['b']);
    expect(t.options.map((o) => o.rank)).toEqual([1, 1]);
  });
});

describe('business case (worked example: cost 50,000 then 20,000 / 25,000 / 15,000 at 8%)', () => {
  const years = [{ period: 0, cost: 50000, benefit: 0 }, { period: 1, cost: 0, benefit: 20000 }, { period: 2, cost: 0, benefit: 25000 }, { period: 3, cost: 0, benefit: 15000 }];
  const b = businessCase(years, 0.08)!;
  it('NPV is 1,859.47 and discounted benefits are 51,859.47', () => {
    expect(b.npv).toBeCloseTo(1859.47, 2);
    expect(b.pvBenefit).toBeCloseTo(51859.47, 2);
    expect(b.bcr).toBeCloseTo(1.0372, 4);
  });
  it('ROI is (60,000 - 50,000) / 50,000 = 20%', () => { expect(b.roi).toBeCloseTo(0.2, 9); });
  it('payback is 2 + 5,000 / 15,000 = 2.333 periods; discounted payback is later (about 2.84)', () => {
    expect(b.payback).toBeCloseTo(2.3333, 4);
    expect(b.discountedPayback).toBeCloseTo(2.844, 3);
  });
  it('IRR makes NPV zero', () => {
    const i = b.irr as number;
    expect(businessCase(years, i)!.npv).toBeCloseTo(0, 5);
  });
  it('without a discount rate, discounted figures stay blank and undiscounted ones still work', () => {
    const n = businessCase(years, null)!;
    expect([n.npv, n.bcr, n.discountedPayback]).toEqual([null, null, null]);
    expect(n.payback).toBeCloseTo(2.3333, 4);
  });
  it('never pays back gives null; no rows gives null', () => {
    expect(businessCase([{ period: 0, cost: 10, benefit: 0 }, { period: 1, cost: 0, benefit: 4 }], 0.1)!.payback).toBeNull();
    expect(businessCase([], 0.1)).toBeNull();
  });
});

describe('stakeholder grid', () => {
  it('maps the four quadrants', () => {
    expect(gridQuadrant(5, 5, 3)).toBe('manage_closely');
    expect(gridQuadrant(5, 1, 3)).toBe('keep_satisfied');
    expect(gridQuadrant(1, 5, 3)).toBe('keep_informed');
    expect(gridQuadrant(1, 1, 3)).toBe('monitor');
    expect(gridQuadrant(3, 3, 3)).toBe('manage_closely');
  });
  it('is blank when anything is missing', () => { expect(gridQuadrant(null, 5, 3)).toBeNull(); expect(gridQuadrant(5, 5, null)).toBeNull(); });
});

describe('solicitations and go / no-go', () => {
  it('counts received, open and overdue against the status date', () => {
    const s = summariseSolicitations([
      { id: '1', kind: 'RFI', vendor: 'a', due: '2026-03-01', received: '2026-02-20', status: null },
      { id: '2', kind: 'RFP', vendor: 'b', due: '2026-03-10', received: null, status: null },
      { id: '3', kind: 'RFP', vendor: 'c', due: '2026-04-10', received: null, status: null },
      { id: '4', kind: 'RFP', vendor: 'd', due: null, received: null, status: null },
    ], '2026-03-31');
    expect(s).toEqual({ total: 4, received: 1, open: 3, overdue: 1, noDue: 1 });
  });
  it('asks for a reason on no-go or hold', () => {
    expect(goRecordGaps({ decision: 'go', decidedBy: 'A', date: '2026-04-01', reason: null })).toEqual([]);
    expect(goRecordGaps({ decision: 'no_go', decidedBy: 'A', date: '2026-04-01', reason: null })).toEqual(['reason']);
    expect(goRecordGaps({ decision: null, decidedBy: null, date: null, reason: null })).toEqual(['decision', 'who decided', 'date']);
  });
});

import { extractTemplate, parseCaseSheet, parseGoRecord, parseScoring, parseSolicitations, parseStakeholders, parseTemplateSettings } from '../src';

describe('reading the Initiate sheets', () => {
  it('Scoring: weights in row 2, one option per row, blank stays blank, bad weight leaves the criterion out', () => {
    const p = parseScoring([['Option', 'Price', 'Fit', 'Risk'], ['Weight', 40, 'x', 30], ['Vendor A', 8, 7, ''], ['Vendor B', 6, 9, 5], ['', '', '', '']]);
    expect(p.criteria).toEqual([{ name: 'Price', weight: 40 }, { name: 'Fit', weight: null }, { name: 'Risk', weight: 30 }]);
    expect(p.problems.length).toBe(1);
    const r = scoreOptions(p.criteria, p.options);
    expect(r.ignored).toEqual(['Fit']);
    expect(r.options[0]).toMatchObject({ option: 'Vendor A', score: null, missing: ['Risk'] });
    expect(r.options[1]?.score).toBeCloseTo((40 * 6 + 30 * 5) / 70, 9);
  });
  it('Business case: periods, blanks count as 0, bad rows are listed', () => {
    const p = parseCaseSheet([['Period', 'Cost', 'Benefit'], [0, 100, ''], [1, '', 60], ['x', 1, 1], [2, '', 'abc']]);
    expect(p.years).toEqual([{ period: 0, cost: 100, benefit: null }, { period: 1, cost: null, benefit: 60 }, { period: 2, cost: null, benefit: null }]);
    expect(p.problems.length).toBe(2);
  });
  it('Stakeholders: scores 1 to 5 only', () => {
    const p = parseStakeholders([['Name', 'Role', 'Power (1-5)', 'Interest (1-5)', 'Note'], ['Sam', 'Sponsor', 5, 4, ''], ['Lee', '', 9, '', '']]);
    expect(p.stakeholders[0]).toMatchObject({ name: 'Sam', power: 5, interest: 4 });
    expect(p.stakeholders[1]).toMatchObject({ power: null, interest: null });
    expect(p.problems.length).toBe(1);
  });
  it('RFI-RFP and Go-no-go', () => {
    const s = parseSolicitations([['ID', 'Type', 'Vendor', 'Due', 'Received', 'Status'], ['S1', 'RFP', 'Acme', '2026-03-10', '', 'Sent']]);
    expect(s.rows[0]).toMatchObject({ vendor: 'Acme', due: '2026-03-10', received: null, status: 'Sent' });
    const g = parseGoRecord([['Decision', 'Decided by', 'Date', 'Reason'], ['No go', 'Board', '2026-04-01', 'Too costly']]);
    expect(g.record).toEqual({ decision: 'no_go', decidedBy: 'Board', date: '2026-04-01', reason: 'Too costly' });
  });
  it('absent sheets are reported as not present; settings read discount rate and high-from', () => {
    const t = extractTemplate([{ name: 'Tasks', data: [['Task']] }])!;
    expect([t.scoring.present, t.businessCase.present, t.stakeholders.present, t.solicitations.present, t.goRecord.present]).toEqual([false, false, false, false, false]);
    const s = parseTemplateSettings([['Discount rate (%)', 8], ['Stakeholder high from', 4]]);
    expect([s.discountRate, s.highFrom]).toEqual([8, 4]);
    expect(parseTemplateSettings([['Discount rate (%)', 'abc'], ['Stakeholder high from', 9]]).problems.length).toBe(2);
  });
});

import { extractLifecycleSheets } from '../src';
describe('workbooks without a Tasks sheet', () => {
  it('still gives the Initiate and Close sheets, settings and a flag saying some are present', () => {
    const none = extractLifecycleSheets([{ name: 'Start here', data: [['x']] }]);
    expect(none.hasInitiateOrClose).toBe(false);
    const r = extractLifecycleSheets([
      { name: 'Settings', data: [['Setting', 'Value'], ['Discount rate (%)', 8], ['Currency', 'INR']] },
      { name: 'Business case', data: [['Period', 'Cost', 'Benefit'], [0, 100, ''], [1, '', 120]] },
      { name: 'Benefits', data: [['Benefit', 'Planned'], ['x', 5]] },
    ]);
    expect(r.hasInitiateOrClose).toBe(true);
    expect(r.settings.discountRate).toBe(8);
    expect(r.businessCase.years.length).toBe(2);
    expect(r.benefits.benefits.length).toBe(1);
    expect(r.scoring.present).toBe(false);
  });
  it('extractTemplate still returns null without Tasks and gives the same parses with it', () => {
    const sheets = [{ name: 'Benefits', data: [['Benefit'], ['x']] }];
    expect(extractTemplate(sheets)).toBeNull();
    const t = extractTemplate([{ name: 'Tasks', data: [['Task']] }, ...sheets])!;
    expect(t.benefits.benefits.length).toBe(1);
  });
});
