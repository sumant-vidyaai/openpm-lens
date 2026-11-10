import { describe, expect, it } from 'vitest';
import { extractTemplate, parseBenefits, parseChecklist, parseLessons, summariseBenefits, summariseChecklist } from '../src';

describe('benefits (worked example from a PMI paper: realised 370,000 vs planned 404,000)', () => {
  const s = summariseBenefits([{ id: 'B1', name: 'x', owner: '', measure: '', planned: 404000, realised: 370000, due: null }]);
  it('BPI is about 0.916 and variance is -34,000', () => {
    expect(s.bpi).toBeCloseTo(0.9158, 4);
    expect(s.variance).toBe(-34000);
    expect(s.rows[0]?.state).toBe('behind');
  });
  it('leaves unmeasured benefits out of totals instead of counting them as 0', () => {
    const m = summariseBenefits([
      { id: 'a', name: 'a', owner: '', measure: '', planned: 100, realised: 80, due: null },
      { id: 'b', name: 'b', owner: '', measure: '', planned: 50, realised: 60, due: null },
      { id: 'c', name: 'c', owner: '', measure: '', planned: 500, realised: null, due: null },
      { id: 'd', name: 'd', owner: '', measure: '', planned: null, realised: 7, due: null },
    ]);
    expect([m.planned, m.realised, m.measured, m.notMeasured, m.behind]).toEqual([150, 140, 3, 1, 1]);
    expect(m.bpi).toBeCloseTo(140 / 150, 9);   // total over total, not the average of 0.8 and 1.2
    expect(m.variance).toBe(-10);
    expect(m.rows.map((r) => r.state)).toEqual(['behind', 'ahead', 'not_measured', 'no_plan']);
  });
  it('gives no total when the units differ, but still gives each benefit its own index', () => {
    const m = summariseBenefits([
      { id: 'a', name: 'a', owner: '', measure: 'calls a month', planned: 400, realised: 340, due: null },
      { id: 'b', name: 'b', owner: '', measure: 'hours saved', planned: 120, realised: 150, due: null },
    ]);
    expect([m.mixedUnits, m.planned, m.realised, m.bpi, m.variance]).toEqual([true, null, null, null, null]);
    expect(m.rows.map((r) => r.bpi)).toEqual([0.85, 1.25]);
    const same = summariseBenefits([
      { id: 'a', name: 'a', owner: '', measure: 'Hours saved', planned: 100, realised: 90, due: null },
      { id: 'b', name: 'b', owner: '', measure: ' hours saved ', planned: 50, realised: 50, due: null },
    ]);
    expect([same.mixedUnits, same.planned, same.realised]).toEqual([false, 150, 140]);
  });
  it('planned 0 gives no ratio; nothing usable gives null totals', () => {
    expect(summariseBenefits([{ id: 'z', name: 'z', owner: '', measure: '', planned: 0, realised: 5, due: null }]).rows[0]?.bpi).toBeNull();
    expect(summariseBenefits([]).bpi).toBeNull();
  });
  it('reads the sheet and lists bad cells', () => {
    const p = parseBenefits([['ID', 'Benefit', 'Owner', 'Measure', 'Planned', 'Realised', 'Due'], ['B1', 'Faster', 'Asha', 'hours saved', 100, 'abc', '2026-06-01'], ['', '', '', '', '', '', '']]);
    expect(p.benefits[0]).toMatchObject({ id: 'B1', planned: 100, realised: null, due: '2026-06-01' });
    expect(p.problems.length).toBe(1);
  });
});

describe('closure checklist', () => {
  const p = parseChecklist([['Group', 'Item', 'Owner', 'Status', 'Done on'],
    ['Acceptance', 'Sign-off received', 'A', 'Done', '2026-03-30'], ['Acceptance', 'Defects triaged', '', 'Open', ''],
    ['Contract closure', 'Invoices paid', '', 'n/a', ''], ['Contract closure', 'Vendor release', '', '', ''], ['Contract closure', 'x', '', 'maybe', '']]);
  const s = summariseChecklist(p.items);
  it('counts not-applicable out and treats a blank status as not known, not done', () => {
    expect(s.groups).toEqual([
      { group: 'Acceptance', done: 1, open: 1, unknown: 0, notApplicable: 0, applicable: 2 },
      { group: 'Contract closure', done: 0, open: 0, unknown: 2, notApplicable: 1, applicable: 2 },
    ]);
    expect([s.done, s.applicable, s.open.length]).toEqual([1, 4, 3]);
    expect(p.problems.length).toBe(1);
  });
});

describe('lessons and template wiring', () => {
  it('reads lessons, defaults a missing category label only for display', () => {
    const p = parseLessons([['Category', 'Lesson', 'Recommendation', 'Owner', 'Raised'], ['Went well', 'Weekly demos', 'Keep them', 'Asha', '2026-03-20'], ['', 'Late vendor', '', '', 'junk']]);
    expect(p.lessons.map((l) => l.category)).toEqual(['Went well', 'Uncategorised']);
    expect(p.problems.length).toBe(1);
  });
  it('extractTemplate reports the new sheets as absent when not in the file', () => {
    const t = extractTemplate([{ name: 'Tasks', data: [['Task']] }])!;
    expect([t.benefits.present, t.checklist.present, t.lessons.present]).toEqual([false, false, false]);
    const t2 = extractTemplate([{ name: 'Tasks', data: [['Task']] }, { name: 'Benefits', data: [['Benefit'], ['x']] }])!;
    expect(t2.benefits.benefits.length).toBe(1);
  });
});
