import { describe, it, expect } from 'vitest';
import { parseCsv, projectListFromTable, suggestProjectListMapping } from '../src';

// Made-up rows with the header names of a real project register. No real data.
const csv = 'Proj ID,Project Name,Project status,Project Lead,Deadline,Last updated\nP1,Alpha,Build,Ann Lee,2026-12-01,2026-11-01\nP2,Beta,Plan,Raj Rao,2026-12-15,\n,,,,,\nP3,Alpha,Test,X,,\nP4,Gamma,Plan,Ann Lee,,11/31/2026\n';
describe('project list import', () => {
  const t = parseCsv(csv);
  it('suggests columns but not Deadline as a gate', () => {
    expect(suggestProjectListMapping(t.headers)).toEqual({ project: 'Project Name', phase: 'Project status', manager: 'Project Lead', lastUpdated: 'Last updated', nextGate: null });
  });
  it('builds register rows, reports repeats and unclear dates, skips blank rows', () => {
    const r = projectListFromTable(t, suggestProjectListMapping(t.headers));
    expect(r.rows.map((x) => [x.project, x.phase, x.manager, x.lastUpdated])).toEqual([
      ['Alpha', 'Build', 'Ann Lee', '2026-11-01'], ['Beta', 'Plan', 'Raj Rao', null], ['Gamma', 'Plan', 'Ann Lee', null],
    ]);
    expect(r.problems.join(' ')).toMatch(/"Alpha" is listed twice/);
    expect(r.problems.join(' ')).toMatch(/not a clear date/);
    expect(r.problems.every((p) => p.startsWith('Project list:'))).toBe(true);
  });
  it('asks for a project column when none is chosen', () => {
    const r = projectListFromTable(t, { project: null, phase: null, manager: null, lastUpdated: null, nextGate: null });
    expect(r.rows).toEqual([]);
    expect(r.problems[0]).toMatch(/choose which column/);
  });
});
