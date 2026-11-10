import { describe, expect, it } from 'vitest';
import { analyseTable, DEFAULT_ANALYSE } from '../src/analyse';
import { parseCsv } from '../src/csv';
import { rollup, rollupGroup, type PortfolioProject } from '../src/portfolio';
import type { ProjectResult } from '../src/analyse';

const mk = (over: Partial<ProjectResult>): ProjectResult => ({
  state: 'ok', adapterName: null, tasks: 10, ev: 80, ac: 100, bac: 200, costTasks: 10,
  evSchedule: 80, pv: 100, scheduleTasks: 10, quality: null, notes: [], ...over,
});
const P = (id: string, programme: string, team: string, r: Partial<ProjectResult>): PortfolioProject =>
  ({ id, name: id, programme, team, result: mk(r) });

describe('rollup', () => {
  it('adds hours first, then divides (no averaging of ratios)', () => {
    // A: EV 10 / AC 20 (CPI 0.5). B: EV 90 / AC 80 (CPI 1.125). Average of CPIs = 0.8125; correct = 100/100 = 1.
    const rows = rollup([P('A', 'X', '', { ev: 10, ac: 20 }), P('B', 'X', '', { ev: 90, ac: 80 })], 'programme');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ev).toBe(100);
    expect(rows[0]?.ac).toBe(100);
    expect(rows[0]?.health.cpi).toBe(1);
    expect(rows[0]?.cv).toBe(0);
  });
  it('groups blanks under a visible label', () => {
    const rows = rollup([P('A', '', '', {}), P('B', 'Alpha', '', {})], 'programme');
    expect(rows.map((r) => r.label)).toEqual(['(no programme)', 'Alpha']);
  });
  it('leaves out projects with no number and counts them', () => {
    const r = rollupGroup('g', 'g', [P('A', '', '', {}), P('B', '', '', { ev: null, ac: null }), P('C', '', '', { state: 'needs_unit', ev: null, ac: null })]);
    expect(r.leftOutCost).toBe(1);
    expect(r.notReady).toBe(1);
    expect(r.ev).toBe(80);
  });
  it('is insufficient when the combined tasks are too few', () => {
    const r = rollupGroup('g', 'g', [P('A', '', '', { costTasks: 2, scheduleTasks: 2 })]);
    expect(r.health.health).toBe('insufficient');
  });
  it('by project gives one row each; all gives one row', () => {
    const ps = [P('A', '', '', {}), P('B', '', '', {})];
    expect(rollup(ps, 'project')).toHaveLength(2);
    expect(rollup(ps, 'all')).toHaveLength(1);
  });
  it('sums tasks and schedule figures', () => {
    const r = rollupGroup('g', 'g', [P('A', '', '', { evSchedule: 30, pv: 60 }), P('B', '', '', { evSchedule: 20, pv: 40 })]);
    expect(r.evSchedule).toBe(50);
    expect(r.pv).toBe(100);
    expect(r.sv).toBe(-50);
    expect(r.tasks).toBe(20);
  });
});

describe('analyseTable', () => {
  const csv = (s: string) => parseCsv(s);
  const plain = 'Task,Planned hours,Actual hours,% complete,Start,Finish\n1,40,44,100,2026-01-05,2026-01-09\n2,80,30,50,2026-01-12,2026-01-23\n';
  it('works out cost and schedule for a plain file (hand-checked)', () => {
    const r = analyseTable(csv(plain), { ...DEFAULT_ANALYSE, statusDate: '2026-01-21' });
    expect(r.state).toBe('ok');
    expect(r.ev).toBe(80); // 40*1 + 80*0.5
    expect(r.ac).toBe(74);
    expect(r.pv).toBe(104); // 40 + 80*0.8
    expect(r.evSchedule).toBe(80);
  });
  it('does not work out schedule without a status date', () => {
    const r = analyseTable(csv(plain));
    expect(r.pv).toBeNull();
    expect(r.notes.join(' ')).toContain('No status date');
  });
  it('refuses to guess a unit when the tool does not document one', () => {
    const clickup = 'Task Name,Time Estimated,Time Spent,Status\nA,3600000,1800000,open\n';
    const r = analyseTable(csv(clickup));
    if (r.adapterName !== null) expect(r.state).toBe('needs_unit');
  });
  it('needs a name column', () => {
    expect(analyseTable(csv('foo,bar\n1,2\n')).state).toBe('needs_name_column');
  });
});
