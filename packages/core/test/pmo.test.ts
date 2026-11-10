import { describe, expect, it } from 'vitest';
import { DEFAULT_ANALYSE, parseCsv, portfolioCapacity, portfolioRisks, priorityView, resourceTasksForTable, parseRisks, type ResourceTask, type RiskInput } from '../src';

const task = (id: string, assignee: string | null, h: number | null, start = '2026-03-02', finish = '2026-03-06'): ResourceTask =>
  ({ id, assignee, plannedHours: h, actualHours: null, plannedStart: start, plannedFinish: finish });
const settings = { capacityDefault: 40, capacityByPerson: {}, mode: { mode: 'weekdays' as const, holidays: [] }, overPercent: 100 };

describe('priorityView', () => {
  const criteria = [{ name: 'Value', weight: 3 }, { name: 'Risk', weight: 1 }];
  const scores = [
    { option: 'P2', scores: { Value: 3, Risk: 5 } },
    { option: 'P1', scores: { Value: 5, Risk: 1 } },
    { option: 'P3', scores: { Value: 4, Risk: null } },
    { option: 'Other', scores: { Value: 1, Risk: 1 } },
  ];
  const v = priorityView(['P1', ' p2 ', 'P3', 'P4'], criteria, scores);
  it('weighted score = sum(weight x score) / sum(weights)', () => {
    expect(v.rows.map((r) => [r.option, r.score])).toEqual([['P1', 4], ['P2', 3.5], ['Other', 1], ['P3', null]]);
    expect(v.rows.find((r) => r.option === 'P1')?.rank).toBe(1);
  });
  it('a missing score gives no score, never zero', () => {
    expect(v.rows.find((r) => r.option === 'P3')?.missing).toEqual(['Risk']);
  });
  it('marks names that are not in the portfolio and lists projects without scores', () => {
    expect(v.rows.find((r) => r.option === 'Other')?.inPortfolio).toBe(false);
    expect(v.rows.find((r) => r.option === 'P2')?.inPortfolio).toBe(true);
    expect(v.notScored).toEqual(['P4']);
  });
});

describe('portfolioCapacity', () => {
  const A = [task('1', 'Asha', 40)];
  const B = [task('1', 'Asha', 20), task('2', 'Ravi', 10)];
  const C = [task('1', null, 8)];
  const r = portfolioCapacity([{ project: 'A', tasks: A }, { project: 'B', tasks: B }, { project: 'C', tasks: C }, { project: 'D', tasks: null }], settings);
  it('adds hours across projects per person', () => {
    const asha = r.result.people.find((p) => p.person === 'Asha');
    expect(asha?.plannedTotal).toBe(60);
    expect(asha?.peak).toBeCloseTo(150, 6);
    expect(r.split.find((p) => p.person === 'Asha')?.byProject).toEqual([{ project: 'A', hours: 40 }, { project: 'B', hours: 20 }]);
  });
  it('week total = total planned / total capacity of named people (ratio of sums)', () => {
    expect(r.weekTotals).toHaveLength(1);
    expect(r.weekTotals[0]?.planned).toBeCloseTo(70, 6);
    expect(r.weekTotals[0]?.capacity).toBe(80);
    expect(r.weekTotals[0]?.utilisation).toBeCloseTo(87.5, 6);
  });
  it('finds people over the limit only when projects are combined', () => {
    expect(r.overOnlyCombined).toEqual(['Asha']);
  });
  it('keeps unassigned work out of the totals and reports it', () => {
    expect(r.unassignedHours).toBe(8);
    expect(r.projectsWithoutAssignee).toEqual(['D']);
  });
  it('a person over the limit within one project is not "only combined"', () => {
    const x = portfolioCapacity([{ project: 'A', tasks: [task('1', 'Asha', 50)] }, { project: 'B', tasks: [task('1', 'Asha', 5)] }], settings);
    expect(x.overOnlyCombined).toEqual([]);
  });
});

describe('resourceTasksForTable', () => {
  const t = parseCsv('Name,Assigned to,Planned hours,Start,Finish\nDesign,Asha,16,2026-03-02,2026-03-03\nBuild,Ravi,8,2026-03-03,2026-03-03\n');
  it('returns null with no assignee column', () => {
    expect(resourceTasksForTable(t, DEFAULT_ANALYSE, null, 'A')).toBeNull();
  });
  it('gives one task per row with the project in the id', () => {
    const out = resourceTasksForTable(t, DEFAULT_ANALYSE, 'Assigned to', 'Alpha');
    expect(out).not.toBeNull();
    expect(out?.map((x) => [x.assignee, x.plannedHours])).toEqual([['Asha', 16], ['Ravi', 8]]);
    expect(out?.[0]?.id.startsWith('Alpha: ')).toBe(true);
  });
});

describe('portfolioRisks', () => {
  const r = (id: string, project: string | undefined, p: number | null, i: number | null, status: RiskInput['status'], due: string | null = null): RiskInput =>
    ({ id, title: id, owner: 'x', response: 'y', action: '', probability: p, impact: i, status, actionDue: due, actionDone: null, ...(project === undefined ? {} : { project }) });
  const res = portfolioRisks([r('R1', 'A', 4, 4, 'open'), r('R2', 'A', 2, 2, 'open'), r('R3', 'B', 3, 3, 'open', '2026-03-01'), r('R4', 'B', 5, 5, 'closed'), r('R5', undefined, null, 3, 'open')], '2026-03-10');
  it('one heat map over all open risks', () => {
    expect(res.overall.heat[3]?.[3]).toBe(1);
    expect(res.overall.heat[2]?.[2]).toBe(1);
    expect(res.overall.heat[1]?.[1]).toBe(1);
    expect(res.overall.heat.flat().reduce((a, b) => a + b, 0)).toBe(3);
  });
  it('counts per project, worst first, closed risks left out', () => {
    expect(res.perProject.map((p) => [p.project, p.high, p.medium, p.low, p.unscored, p.overdueActions, p.open])).toEqual([
      ['A', 1, 0, 1, 0, 0, 2], ['B', 0, 1, 0, 0, 1, 1], ['(no project named)', 0, 0, 0, 1, 0, 1],
    ]);
  });
  it('top list names the project, highest score first, unscored left out', () => {
    expect(res.top.map((t) => [t.id, t.project, t.score])).toEqual([['R1', 'A', 16], ['R3', 'B', 9], ['R2', 'A', 4]]);
  });
});

describe('Risks sheet Project column', () => {
  it('reads the optional Project column and does not complain when absent', () => {
    const withCol = parseRisks([['ID', 'Risk', 'Project'], ['R1', 'Late', 'Alpha']]);
    expect(withCol.risks[0]?.project).toBe('Alpha');
    const without = parseRisks([['ID', 'Risk'], ['R1', 'Late']]);
    expect(without.risks[0]?.project).toBeUndefined();
    expect(without.problems.join(' ')).not.toMatch(/Project/);
  });
});
