import { describe, expect, it } from 'vitest';
import { analyseChanges, analyseIssues, analyseRisks, bandOf, parseChanges, parseIssues, parseRisks } from '../src';

const RH = ['ID', 'Risk', 'Probability (1-5)', 'Impact (1-5)', 'Owner', 'Response', 'Status', 'Action', 'Action due', 'Action done'];
const risks = parseRisks([
  RH,
  ['R1', 'Vendor slips', 4, 4, 'Asha', 'Mitigate', 'Open', 'Add buffer', '2026-03-20', null],
  ['R2', 'Minor rework', 2, 3, '', '', 'Open', '', null, null],
  ['R3', 'Key person leaves', 3, 3, 'Ravi', 'Accept', 'Open', 'Cross-train', '2026-03-25', '2026-03-24'],
  ['R4', 'Old risk', 5, 5, 'Meena', 'Avoid', 'Closed', '', null, null],
  ['R5', 'Unscored', null, 3, 'Dev', 'Watch', 'Open', '', null, null],
  ['R6', 'Happened', 2, 2, 'Kiran', 'Fix', 'Occurred', '', null, null],
  ['R7', 'No status', 1, 1, '', '', '', '', null, null],
  [null, null, null, null, null, null, null, null, null, null],
]);

describe('risks', () => {
  it('reads the sheet and lists nothing wrong for clean rows', () => {
    expect(risks.risks).toHaveLength(7);
    expect(risks.problems).toEqual([]);
  });
  it('scores probability x impact and bands them (hand-worked)', () => {
    const r = analyseRisks(risks.risks, '2026-03-31');
    const by = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(by['R1']!.score).toBe(16);
    expect(by['R1']!.band).toBe('high');
    expect(by['R3']!.score).toBe(9);
    expect(by['R3']!.band).toBe('medium');
    expect(by['R2']!.score).toBe(6);
    expect(by['R2']!.band).toBe('low');
    expect(by['R5']!.score).toBeNull();
    expect(r.openCounts).toEqual({ low: 1, medium: 1, high: 1 });
    expect(r.openUnscored).toBe(1);
    expect(r.closed).toBe(1);
    expect(r.occurred).toBe(1);
    expect(r.statusUnknown).toBe(1);
  });
  it('band limits: 6 low, 7 medium, 12 medium, 13 high; custom limits apply', () => {
    expect([6, 7, 12, 13].map((s) => bandOf(s, 7, 13))).toEqual(['low', 'medium', 'medium', 'high']);
    const r = analyseRisks(risks.risks, '2026-03-31', { mediumMin: 10, highMin: 15 });
    expect(r.rows.find((x) => x.id === 'R3')!.band).toBe('low');
    expect(r.rows.find((x) => x.id === 'R1')!.band).toBe('high');
  });
  it('heat map counts open scored risks by impact row and probability column', () => {
    const h = analyseRisks(risks.risks, '2026-03-31').heat;
    expect(h[3]![3]).toBe(1); // R1: impact 4, probability 4
    expect(h[2]![1]).toBe(1); // R2: impact 3, probability 2
    expect(h[2]![2]).toBe(1); // R3
    expect(h.flat().reduce((a, b) => a + b, 0)).toBe(3); // closed, occurred, unscored and unknown are not on the map
  });
  it('flags an overdue action (11 days) only when not done; none without a status date', () => {
    const r = analyseRisks(risks.risks, '2026-03-31');
    expect(r.rows.find((x) => x.id === 'R1')!.actionOverdueDays).toBe(11);
    expect(r.rows.find((x) => x.id === 'R3')!.actionOverdueDays).toBeNull();
    expect(r.overdueActions).toBe(1);
    expect(analyseRisks(risks.risks, null).overdueActions).toBe(0);
  });
  it('counts open risks with no owner or no response', () => {
    const r = analyseRisks(risks.risks, '2026-03-31');
    expect(r.openNoOwner).toBe(1); // R2
    expect(r.openNoResponse).toBe(1); // R2
  });
  it('puts highest score first among open risks', () => {
    expect(analyseRisks(risks.risks, '2026-03-31').rows.slice(0, 3).map((x) => x.id)).toEqual(['R1', 'R3', 'R2']);
  });
  it('lists bad values instead of guessing', () => {
    const p = parseRisks([RH, ['R1', 'x', 6, 'high', '', '', 'Maybe', '', '31/31/2026', null]]);
    expect(p.risks[0]!.probability).toBeNull();
    expect(p.risks[0]!.impact).toBeNull();
    expect(p.risks[0]!.status).toBeNull();
    expect(p.problems.length).toBe(4);
  });
  it('is absent without the sheet and ignores a sheet with no Risk column', () => {
    expect(parseRisks(undefined).present).toBe(false);
    expect(parseRisks([['A', 'B'], ['1', '2']]).risks).toEqual([]);
  });
  it('finds columns by heading, in any order', () => {
    const p = parseRisks([['Impact (1-5)', 'Risk', 'Probability (1-5)', 'Status'], [2, 'x', 5, 'Open']]);
    expect(analyseRisks(p.risks, null).rows[0]!.score).toBe(10);
  });
});

const IH = ['ID', 'Issue', 'Priority', 'Owner', 'Status', 'Raised', 'Due', 'Resolved'];
const issues = parseIssues([
  IH,
  ['I1', 'Server down', 'High', 'Asha', 'Open', '2026-03-01', '2026-03-20', null],
  ['I2', 'Slow report', 'Low', '', 'Open', '2026-03-21', null, null],
  ['I3', 'Login bug', 'Critical', 'Ravi', 'Resolved', '2026-03-01', null, '2026-03-05'],
  ['I4', 'Typo', 'Low', 'Meena', 'Closed', '2026-03-10', null, '2026-03-12'],
  ['I5', 'No date', 'Medium', 'Dev', 'Open', null, null, null],
  ['I6', 'No status', null, null, null, '2026-03-02', null, null],
]);
describe('issues', () => {
  const r = analyseIssues(issues.issues, '2026-03-31');
  it('counts by status', () => {
    expect([r.open, r.resolved, r.closed, r.statusUnknown]).toEqual([3, 1, 1, 1]);
  });
  it('age of open issues = status date minus raised (30 and 10 days); oldest 30', () => {
    expect(r.rows.find((x) => x.id === 'I1')!.days).toBe(30);
    expect(r.rows.find((x) => x.id === 'I2')!.days).toBe(10);
    expect(r.oldestOpen).toBe(30);
    expect(r.rows[0]!.id).toBe('I1');
  });
  it('overdue = open and due before the status date (11 days)', () => {
    expect(r.overdue).toBe(1);
    expect(r.rows.find((x) => x.id === 'I1')!.overdueDays).toBe(11);
  });
  it('average days to resolve = (4 + 2) / 2 = 3', () => {
    expect(r.averageDaysToResolve).toBe(3);
    expect(r.resolvedWithDates).toBe(2);
  });
  it('does not guess a missing date, owner or status', () => {
    expect(r.openNoDate).toBe(1);
    expect(r.openNoOwner).toBe(1);
    expect(r.rows.find((x) => x.id === 'I5')!.days).toBeNull();
  });
  it('open by priority', () => {
    expect(r.openByPriority).toMatchObject({ High: 1, Low: 1, Medium: 1, Critical: 0 });
  });
  it('no ages without a status date', () => {
    const n = analyseIssues(issues.issues, null);
    expect(n.oldestOpen).toBeNull();
    expect(n.overdue).toBe(0);
  });
});

const CH = ['ID', 'Change', 'Requested by', 'Decision', 'Requested', 'Decided', 'Cost impact (h)', 'Schedule impact (days)'];
const changes = parseChanges([
  CH,
  ['C1', 'Add report', 'Sponsor', 'Approved', '2026-03-01', '2026-03-10', 40, 5],
  ['C2', 'New field', 'PM', 'Approved', '2026-02-20', '2026-03-05', 20, 2],
  ['C3', 'Drop module', 'PM', 'Approved', '2026-03-12', '2026-03-20', null, 1],
  ['C4', 'New feed', 'Ops', 'Requested', '2026-03-15', null, 30, 3],
  ['C5', 'Logo', 'Sponsor', 'Rejected', '2026-03-02', '2026-03-03', 10, 0],
  ['C6', 'Saving', 'PM', 'Approved', '2026-03-22', '2026-03-23', -8, -1],
]);
describe('changes', () => {
  const r = analyseChanges(changes.changes, '2026-03-31', 600);
  it('counts decisions', () => {
    expect([r.requested, r.approved, r.rejected, r.withdrawn]).toEqual([1, 4, 1, 0]);
  });
  it('approved totals: 40 + 20 - 8 = 52 hours and 5 + 2 + 1 - 1 = 7 days; missing cost listed, not 0', () => {
    expect(r.approvedHours).toBe(52);
    expect(r.approvedDays).toBe(7);
    expect(r.approvedMissingHours).toBe(1);
    expect(r.approvedMissingDays).toBe(0);
  });
  it('running totals follow the decided date: C2 20, C1 60, C3 60, C6 52', () => {
    const ap = r.rows.filter((x) => x.decision === 'approved');
    expect(ap.map((x) => x.id)).toEqual(['C2', 'C1', 'C3', 'C6']);
    expect(ap.map((x) => x.runningHours)).toEqual([20, 60, 60, 52]);
    expect(ap.map((x) => x.runningDays)).toEqual([2, 7, 8, 7]);
  });
  it('scope growth = 52 / 600 = 8.67 %; null without an original budget', () => {
    expect(r.scopeGrowthPercent).toBeCloseTo(8.6667, 3);
    expect(analyseChanges(changes.changes, '2026-03-31', null).scopeGrowthPercent).toBeNull();
  });
  it('days waiting for an undecided request = 16', () => {
    expect(r.rows.find((x) => x.id === 'C4')!.waitingDays).toBe(16);
    expect(r.longestWaiting).toBe(16);
  });
  it('lists bad numbers instead of counting them', () => {
    const p = parseChanges([CH, ['C1', 'x', '', 'Approved', '', '', 'lots', '2 weeks']]);
    expect(p.changes[0]!.costHours).toBeNull();
    expect(p.changes[0]!.scheduleDays).toBeNull();
    expect(p.problems.length).toBe(2);
  });
});

import { extractTemplate, parseTemplateSettings } from '../src';
describe('template settings and sheets for risks, issues and changes', () => {
  it('reads original budget and risk limits; ignores bad ones with a message', () => {
    const ok = parseTemplateSettings([['Setting', 'Value'], ['Original budget (h)', 600], ['Risk medium from', 5], ['Risk high from', 10]]);
    expect([ok.originalBudget, ok.riskMediumMin, ok.riskHighMin, ok.problems.length]).toEqual([600, 5, 10, 0]);
    const bad = parseTemplateSettings([['Setting', 'Value'], ['Original budget (h)', 0], ['Risk medium from', 12], ['Risk high from', 8]]);
    expect([bad.originalBudget, bad.riskMediumMin, bad.riskHighMin]).toEqual([null, null, null]);
    expect(bad.problems.length).toBe(2);
    expect(parseTemplateSettings([['Risk medium from', 30]]).riskMediumMin).toBeNull();
  });
  it('blank settings stay null (never defaulted)', () => {
    const s = parseTemplateSettings([['Setting', 'Value'], ['Original budget (h)', null]]);
    expect([s.originalBudget, s.riskMediumMin, s.riskHighMin]).toEqual([null, null, null]);
  });
  it('extractTemplate finds the three sheets; absent sheets are not present', () => {
    const p = extractTemplate([{ name: 'Tasks', data: [] }, { name: 'Risks', data: [RH, ['R1', 'x', 2, 2, '', '', 'Open', '', null, null]] }, { name: 'Changes', data: [CH, ['C1', 'y', '', 'Approved', '', '', 5, 1]] }])!;
    expect(p.risks.risks.length).toBe(1);
    expect(p.changes.changes.length).toBe(1);
    expect(p.issues.present).toBe(false);
  });
});
