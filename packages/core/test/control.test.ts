import { describe, expect, it } from 'vitest';
import { parsePhaseOrder, parseRegister, portfolioQuality, stageGateView, updateDiscipline, NO_MANAGER, NO_PHASE, type RegisterRow, type PortfolioProject, analyseTable, parseCsv, extractLifecycleSheets, parseTemplateSettings } from '../src';

const reg = (project: string, phase: string, manager: string, lastUpdated: string | null, nextGate: string | null): RegisterRow => ({ project, phase, manager, lastUpdated, nextGate });

describe('parseRegister', () => {
  it('reads rows, dates and reports duplicates and unclear dates', () => {
    const r = parseRegister([
      ['Project', 'Phase', 'Project manager', 'Last updated', 'Next gate'],
      ['Alpha', 'Build', 'Asha', '2026-03-20', '2026-04-10'],
      ['Beta', '', '', 'soon', ''],
      ['alpha', 'Idea', 'X', '', ''],
      ['', 'Idea', '', '', ''],
    ]);
    expect(r.present).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({ project: 'Alpha', phase: 'Build', manager: 'Asha', lastUpdated: '2026-03-20', nextGate: '2026-04-10' });
    expect(r.rows[1]?.lastUpdated).toBeNull();
    expect(r.problems.join(' ')).toMatch(/"soon"/);
    expect(r.problems.join(' ')).toMatch(/listed twice/);
    expect(r.problems.join(' ')).toMatch(/no project name/);
  });
  it('is absent without the sheet, and ignored without a Project column', () => {
    expect(parseRegister(undefined).present).toBe(false);
    expect(parseRegister([['Phase'], ['x']]).rows).toHaveLength(0);
  });
  it('is picked up by extractLifecycleSheets by sheet name', () => {
    const life = extractLifecycleSheets([{ name: 'Projects', data: [['Project'], ['A']] }]);
    expect(life.register.rows.map((x) => x.project)).toEqual(['A']);
  });
});

describe('settings', () => {
  it('reads Phase order and Update due every (days)', () => {
    const s = parseTemplateSettings([['Phase order', 'Idea, Build; Launch\nIdea'], ['Update due every (days)', 14]]);
    expect(s.phaseOrder).toEqual(['Idea', 'Build', 'Launch']);
    expect(s.updateDue).toBe(14);
  });
  it('ignores a bad due value and says so', () => {
    const s = parseTemplateSettings([['Update due every (days)', 0]]);
    expect(s.updateDue).toBeNull();
    expect(s.problems.join(' ')).toMatch(/Update due every/);
  });
  it('never defaults', () => {
    const s = parseTemplateSettings([]);
    expect(s.phaseOrder).toEqual([]);
    expect(s.updateDue).toBeNull();
  });
});

describe('parsePhaseOrder', () => {
  it('splits and drops repeats case-insensitively', () => { expect(parsePhaseOrder('a, B ;b\nA, c')).toEqual(['a', 'B', 'c']); });
});

describe('updateDiscipline', () => {
  const rows = [
    reg('A', 'x', 'Asha', '2026-03-17', null), // 14 days before 31 Mar: not more than 14 -> on time
    reg('B', 'x', 'Asha', '2026-03-16', null), // 15 days -> overdue
    reg('C', 'x', 'Ravi', null, null), // no date
    reg('D', 'x', '', '2026-04-05', null), // after the status date
    reg('E', 'x', 'Ravi', '2026-03-01', null), // 30 days -> overdue
  ];
  it('counts days to the status date; late means MORE than the entered days', () => {
    const d = updateDiscipline(rows, '2026-03-31', 14);
    const by = Object.fromEntries(d.rows.map((r) => [r.project, r]));
    expect(by.A).toMatchObject({ daysSince: 14, state: 'on_time' });
    expect(by.B).toMatchObject({ daysSince: 15, state: 'overdue' });
    expect(by.C).toMatchObject({ daysSince: null, state: 'no_date' });
    expect(by.D).toMatchObject({ daysSince: -5, state: 'after_status_date' });
    expect(by.E).toMatchObject({ daysSince: 30, state: 'overdue' });
    expect(d.judged).toBe(true);
  });
  it('groups by manager with counts and the longest gap, most overdue first, then longest gap', () => {
    const d = updateDiscipline(rows, '2026-03-31', 14);
    expect(d.managers.map((m) => m.manager)).toEqual(['Ravi', 'Asha', NO_MANAGER]);
    expect(d.managers[0]).toMatchObject({ manager: 'Ravi', projects: 2, overdue: 1, noDate: 1, longestGapDays: 30 });
    expect(d.managers[1]).toMatchObject({ manager: 'Asha', projects: 2, overdue: 1, longestGapDays: 15 });
    expect(d.managers[2]).toMatchObject({ projects: 1, afterStatusDate: 1, longestGapDays: null });
  });
  it('calls nothing overdue without an entered number, and without a status date everything has no date', () => {
    const d = updateDiscipline(rows, '2026-03-31', null);
    expect(d.judged).toBe(false);
    expect(d.rows.filter((r) => r.state === 'overdue')).toHaveLength(0);
    expect(d.rows.find((r) => r.project === 'B')?.state).toBe('not_judged');
    expect(updateDiscipline(rows, null, 14).rows.every((r) => r.state === 'no_date')).toBe(true);
  });
});

const task = (name: string, status: string, est: number, act: number, pct: number) => `${name},${status},${est},${act},${pct},2026-03-01,2026-03-10`;
const csv = (lines: string[]) => parseCsv(['Task,Status,Estimate (h),Actual (h),% complete,Planned start,Planned finish', ...lines].join('\n'));
const proj = (name: string, lines: string[]): PortfolioProject => ({ id: name, name, programme: '', team: '', result: analyseTable(csv(lines), { ...({} as object), statusDate: '2026-03-31', dateOrder: 'auto', dayCount: 'weekdays', holidays: [], hoursPerDay: 8, percentScale: '0-100', ruleOverride: 'tool_reported', inProgressPercent: 50, unitOverride: 'hours' } as never) });

describe('stageGateView', () => {
  const register = [
    reg('Alpha', 'Build', 'Asha', null, '2026-04-10'),
    reg('Beta', 'Idea', 'Ravi', null, '2026-03-25'),
    reg('Gamma', 'Pilot', 'Ravi', null, null),
    reg('Delta', '', 'Asha', null, '2026-03-31'),
  ];
  const portfolio = [proj('Alpha', [task('a', 'Done', 10, 10, 100), task('b', 'In progress', 10, 5, 50)]), proj('Omega', [task('z', 'Done', 5, 5, 100)])];
  const v = stageGateView(register, portfolio, ['Idea', 'Build', 'Launch'], '2026-03-31');
  it('uses the typed order first (even empty phases), then others as found, then no phase', () => {
    expect(v.phases.map((p) => p.phase)).toEqual(['Idea', 'Build', 'Launch', 'Pilot', NO_PHASE]);
    expect(v.phases.find((p) => p.phase === 'Launch')?.projects).toHaveLength(0);
    expect(v.orderFromData).toBe(false);
  });
  it('works out gate state against the status date', () => {
    const idea = v.phases[0]!.projects[0]!;
    expect(idea).toMatchObject({ project: 'Beta', gateState: 'passed', gateDays: 6, hasNumbers: false });
    expect(v.phases[1]!.projects[0]).toMatchObject({ project: 'Alpha', gateState: 'upcoming', gateDays: 10, hasNumbers: true });
    expect(v.phases[4]!.projects[0]).toMatchObject({ project: 'Delta', gateState: 'upcoming', gateDays: 0 });
    expect(v.phases[3]!.projects[0]).toMatchObject({ gateState: 'none', gateDays: null });
    expect(v.phases[0]!.gatesPassed).toBe(1);
  });
  it('gives a roll-up only where projects have numbers, and lists projects missing from the register', () => {
    expect(v.phases[1]!.rollup).not.toBeNull();
    expect(v.phases[0]!.rollup).toBeNull();
    expect(v.notInRegister).toEqual(['Omega']);
  });
  it('matches names ignoring case and spaces; without a status date the gate state is unknown', () => {
    const w = stageGateView([reg(' alpha ', 'Build', '', null, '2026-04-10')], portfolio, [], null);
    expect(w.phases[0]!.projects[0]).toMatchObject({ hasNumbers: true, gateState: 'unknown' });
    expect(w.orderFromData).toBe(true);
  });
});

describe('portfolioQuality', () => {
  it('ranks lowest score first, puts not-scored last, and never blends scores', () => {
    const good = proj('Good', Array.from({ length: 6 }, (_, i) => task(`t${i}`, 'Done', 5, 5, 100)));
    const poor = proj('Poor', [...Array.from({ length: 3 }, (_, i) => task(`t${i}`, 'Done', 5, 5, 100)), ...Array.from({ length: 3 }, (_, i) => `u${i},Done,,,,,`)]);
    const few = proj('Few', [task('a', 'Done', 5, 5, 100)]);
    const q = portfolioQuality([good, few, poor]);
    expect(q.rows.map((r) => r.name)).toEqual(['Poor', 'Good', 'Few']);
    expect(q.rows[0]!.score).toBeLessThan(q.rows[1]!.score as number);
    expect(q.rows[2]!.score).toBeNull();
    expect(q.scored).toBe(2);
    expect(q.notScored).toBe(1);
    expect(q.lowest).toBe(q.rows[0]!.score);
    expect(q.highest).toBe(q.rows[1]!.score);
  });
  it('reports an empty portfolio', () => {
    const q = portfolioQuality([]);
    expect(q).toMatchObject({ scored: 0, notScored: 0, lowest: null, highest: null });
  });
});
