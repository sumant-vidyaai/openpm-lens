/**
 * Project list import: turns any table that lists projects (a register, a Smartsheet or Excel list, a CSV from a tool)
 * into the Projects register used by the Portfolio views. The person chooses which column is which;
 * the suggestions below are only a starting point. Nothing is filled in for columns that are not chosen.
 */
import type { CsvResult } from './csv';
import { parseRegister, type RegisterParse } from './control';
import type { GridCell } from './csv';

export type ProjectListField = 'project' | 'phase' | 'manager' | 'lastUpdated' | 'nextGate';
export type ProjectListMapping = Record<ProjectListField, string | null>;

export const PROJECT_LIST_FIELDS: { field: ProjectListField; label: string; required: boolean }[] = [
  { field: 'project', label: 'Project name', required: true },
  { field: 'phase', label: 'Phase or status', required: false },
  { field: 'manager', label: 'Project manager or lead', required: false },
  { field: 'lastUpdated', label: 'Last updated (date)', required: false },
  { field: 'nextGate', label: 'Next gate (date)', required: false },
];

// Names seen in real project lists. "Deadline" is deliberately not suggested as a gate date: a client deadline is not a stage gate.
const ALIASES: Record<ProjectListField, string[]> = {
  project: ['project name', 'project', 'project title', 'name'],
  phase: ['phase', 'stage', 'project status', 'project phase', 'status'],
  manager: ['project manager', 'project lead', 'manager', 'lead', 'owner', 'pm'],
  lastUpdated: ['last updated', 'last update', 'last modified', 'modified', 'updated'],
  nextGate: ['next gate', 'gate date', 'next gate date'],
};

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function suggestProjectListMapping(headers: readonly string[]): ProjectListMapping {
  const out: ProjectListMapping = { project: null, phase: null, manager: null, lastUpdated: null, nextGate: null };
  const used = new Set<string>();
  for (const f of Object.keys(ALIASES) as ProjectListField[]) {
    for (const a of ALIASES[f]) {
      const h = headers.find((x) => norm(x) === a && !used.has(x));
      if (h !== undefined) { out[f] = h; used.add(h); break; }
    }
  }
  return out;
}

/** Builds the register from a table and a column choice. Blank, repeated and unclear rows are reported, not guessed. */
export function projectListFromTable(table: CsvResult, mapping: ProjectListMapping): RegisterParse {
  if (mapping.project === null || !table.headers.includes(mapping.project)) {
    return { rows: [], problems: ['Project list: choose which column holds the project name.'], present: true };
  }
  const cols: { head: string; col: string | null }[] = [
    { head: 'Project', col: mapping.project }, { head: 'Phase', col: mapping.phase }, { head: 'Project manager', col: mapping.manager },
    { head: 'Last updated', col: mapping.lastUpdated }, { head: 'Next gate', col: mapping.nextGate },
  ];
  const picked = cols.filter((c) => c.col !== null && table.headers.includes(c.col));
  const idx = picked.map((c) => table.headers.indexOf(c.col as string));
  const grid: GridCell[][] = [picked.map((c) => c.head), ...table.rows.map((r) => idx.map((i) => r[i] ?? ''))];
  const parsed = parseRegister(grid);
  return { ...parsed, problems: parsed.problems.map((p) => p.replace(/^Projects: row (\d+)/, 'Project list: row $1').replace(/^Projects:/, 'Project list:')) };
}
