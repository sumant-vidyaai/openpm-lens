import type { GridCell } from './csv';
import { parseDateText } from './dates';
import { rollupGroup, type PortfolioProject, type RollupRow } from './portfolio';
import { DEFAULT_THRESHOLDS, type HealthThresholds } from './health';
import { issueLabel } from './quality';
import { daysBetween } from './raid';
import type { DataIssueCode } from './model';

/**
 * Portfolio control (v1.4.0): a project register with phase, manager, last update and next gate,
 * a stage-gate view, reporting discipline ("who has not updated") and a data-quality ranking.
 *
 * Nothing here is a standard. Phase names and their order, and how many days make an update late,
 * are entered by the user and never defaulted. A blank date is reported as missing, never as fresh or stale.
 * A gate date that has passed says only that the date has passed; the app cannot know whether the gate decision was made.
 */

export const NO_PHASE = '(no phase)';
export const NO_MANAGER = '(no project manager named)';

/* ---------- reading the optional "Projects" sheet ---------- */
const t_ = (c: GridCell | undefined): string => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10);
  return String(c).trim();
};
const idx = (grid: GridCell[][], name: string) => (grid[0] ?? []).map((h) => t_(h).toLowerCase()).indexOf(name.toLowerCase());

export interface RegisterRow {
  project: string;
  phase: string;
  manager: string;
  /** ISO date of the last update, or null when blank or unclear. */
  lastUpdated: string | null;
  /** ISO date of the next stage gate, or null when blank or unclear. */
  nextGate: string | null;
}
export interface RegisterParse { rows: RegisterRow[]; problems: string[]; present: boolean }

/** "Projects" sheet: Project, Phase, Project manager, Last updated, Next gate. Only "Project" is required. */
export function parseRegister(grid: GridCell[][] | undefined): RegisterParse {
  if (grid === undefined) return { rows: [], problems: [], present: false };
  const iP = idx(grid, 'Project'), iPh = idx(grid, 'Phase'), iM = idx(grid, 'Project manager'), iU = idx(grid, 'Last updated'), iG = idx(grid, 'Next gate');
  if (iP < 0) return { rows: [], problems: ['Projects: no "Project" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const rows: RegisterRow[] = [];
  const seen = new Set<string>();
  grid.slice(1).forEach((r, i) => {
    if (r.every((c) => t_(c) === '')) return;
    const row = i + 2;
    const project = t_(r[iP]);
    if (project === '') { problems.push(`Projects: row ${row} has no project name and was ignored.`); return; }
    const key = project.toLowerCase();
    if (seen.has(key)) { problems.push(`Projects: "${project}" is listed twice; the first row was used.`); return; }
    seen.add(key);
    const date = (j: number, what: string): string | null => {
      if (j < 0) return null;
      const s = t_(r[j]);
      if (s === '') return null;
      const iso = parseDateText(s, 'auto', 'date').iso;
      if (iso === null) problems.push(`Projects: row ${row} "${what}" is "${s}", which is not a clear date (write year-month-day). It was ignored.`);
      return iso;
    };
    rows.push({
      project, phase: iPh < 0 ? '' : t_(r[iPh]), manager: iM < 0 ? '' : t_(r[iM]),
      lastUpdated: date(iU, 'Last updated'), nextGate: date(iG, 'Next gate'),
    });
  });
  return { rows, problems, present: true };
}

/** Reads a typed list of phase names (commas, semicolons or new lines). Repeats are dropped (case-insensitive). */
export function parsePhaseOrder(text: string): string[] {
  const out: string[] = [];
  for (const p of text.split(/[\n,;]+/).map((x) => x.trim()).filter((x) => x !== '')) {
    if (!out.some((o) => o.toLowerCase() === p.toLowerCase())) out.push(p);
  }
  return out;
}

/* ---------- stage-gate view ---------- */
export type GateState = 'none' | 'unknown' | 'upcoming' | 'passed';
export interface GateProject {
  project: string;
  manager: string;
  nextGate: string | null;
  gateState: GateState;
  /** Days from the status date to the gate (upcoming), or since the gate date (passed). Null when none or unknown. */
  gateDays: number | null;
  /** True when the project has task numbers loaded in the portfolio. */
  hasNumbers: boolean;
}
export interface PhaseRow {
  phase: string;
  /** True when the phase came from the typed order, so it is shown even with no projects. */
  fromOrder: boolean;
  projects: GateProject[];
  /** Health of the projects in this phase that have numbers (hours added first, then ratios). Null with none. */
  rollup: RollupRow | null;
  gatesPassed: number;
}
export interface StageGateView {
  phases: PhaseRow[];
  /** Portfolio projects with numbers that are not in the Projects sheet. */
  notInRegister: string[];
  /** True when no phase order was typed, so phases are shown in the order they were found. */
  orderFromData: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

export function stageGateView(
  register: RegisterRow[], portfolio: PortfolioProject[], phaseOrder: string[], statusDate: string | null, t: HealthThresholds = DEFAULT_THRESHOLDS,
): StageGateView {
  const byName = new Map(portfolio.map((p) => [norm(p.name), p]));
  const order = phaseOrder.map((p) => p);
  const found: string[] = [];
  for (const r of register) {
    const ph = r.phase.trim() === '' ? NO_PHASE : r.phase.trim();
    if (!order.some((o) => norm(o) === norm(ph)) && !found.some((f) => norm(f) === norm(ph)) && ph !== NO_PHASE) found.push(ph);
  }
  const names = [...order, ...found];
  if (register.some((r) => r.phase.trim() === '')) names.push(NO_PHASE);
  const phases: PhaseRow[] = names.map((name) => {
    const mine = register.filter((r) => (r.phase.trim() === '' ? NO_PHASE : r.phase.trim()).toLowerCase() === norm(name));
    const projects: GateProject[] = mine.map((r) => {
      let gateState: GateState = 'none'; let gateDays: number | null = null;
      if (r.nextGate !== null) {
        if (statusDate === null) gateState = 'unknown';
        else {
          const d = daysBetween(statusDate, r.nextGate);
          if (d < 0) { gateState = 'passed'; gateDays = -d; } else { gateState = 'upcoming'; gateDays = d; }
        }
      }
      return { project: r.project, manager: r.manager.trim(), nextGate: r.nextGate, gateState, gateDays, hasNumbers: byName.has(norm(r.project)) };
    });
    const withNumbers = mine.map((r) => byName.get(norm(r.project))).filter((p): p is PortfolioProject => p !== undefined);
    return {
      phase: name, fromOrder: order.some((o) => norm(o) === norm(name)), projects,
      rollup: withNumbers.length === 0 ? null : rollupGroup(name, name, withNumbers, t),
      gatesPassed: projects.filter((p) => p.gateState === 'passed').length,
    };
  });
  const inReg = new Set(register.map((r) => norm(r.project)));
  return { phases, notInRegister: portfolio.filter((p) => !inReg.has(norm(p.name))).map((p) => p.name), orderFromData: phaseOrder.length === 0 };
}

/* ---------- reporting discipline ---------- */
export type UpdateState = 'on_time' | 'overdue' | 'not_judged' | 'no_date' | 'after_status_date';
export interface UpdateRow { project: string; manager: string; lastUpdated: string | null; daysSince: number | null; state: UpdateState }
export interface ManagerRow { manager: string; projects: number; overdue: number; noDate: number; afterStatusDate: number; longestGapDays: number | null }
export interface UpdateDiscipline { rows: UpdateRow[]; managers: ManagerRow[]; judged: boolean }

/**
 * Days since each project's last update, counted to the status date. An update is overdue when the gap is MORE than
 * the number of days the user entered; a gap equal to it is on time. With no number entered nothing is called overdue.
 */
export function updateDiscipline(register: RegisterRow[], statusDate: string | null, dueDays: number | null): UpdateDiscipline {
  const rows: UpdateRow[] = register.map((r) => {
    const manager = r.manager.trim() === '' ? NO_MANAGER : r.manager.trim();
    if (r.lastUpdated === null || statusDate === null) return { project: r.project, manager, lastUpdated: r.lastUpdated, daysSince: null, state: 'no_date' as const };
    const d = daysBetween(r.lastUpdated, statusDate);
    if (d < 0) return { project: r.project, manager, lastUpdated: r.lastUpdated, daysSince: d, state: 'after_status_date' as const };
    const state: UpdateState = dueDays === null ? 'not_judged' : d > dueDays ? 'overdue' : 'on_time';
    return { project: r.project, manager, lastUpdated: r.lastUpdated, daysSince: d, state };
  });
  const groups = new Map<string, UpdateRow[]>();
  for (const r of rows) groups.set(r.manager, [...(groups.get(r.manager) ?? []), r]);
  const managers: ManagerRow[] = [...groups.entries()].map(([manager, g]) => {
    const gaps = g.filter((r) => r.daysSince !== null && r.daysSince >= 0).map((r) => r.daysSince as number);
    return {
      manager, projects: g.length, overdue: g.filter((r) => r.state === 'overdue').length, noDate: g.filter((r) => r.state === 'no_date').length,
      afterStatusDate: g.filter((r) => r.state === 'after_status_date').length, longestGapDays: gaps.length === 0 ? null : Math.max(...gaps),
    };
  }).sort((a, b) => b.overdue - a.overdue || (b.longestGapDays ?? -1) - (a.longestGapDays ?? -1) || a.manager.localeCompare(b.manager));
  rows.sort((a, b) => (b.daysSince ?? -1) - (a.daysSince ?? -1) || a.project.localeCompare(b.project));
  return { rows, managers, judged: dueDays !== null };
}

/* ---------- portfolio data quality ---------- */
export interface QualityRow {
  id: string;
  name: string;
  /** 0 to 100, or null when withheld (too few tasks) or the project could not be worked out. */
  score: number | null;
  reason: string;
  /** The most common problem found while reading this project, in words, or null. */
  topProblem: string | null;
  tasks: number;
}
export interface PortfolioQuality { rows: QualityRow[]; scored: number; notScored: number; lowest: number | null; highest: number | null }

/** Ranks projects by their own data-quality score, lowest first. Scores are never averaged into one number. */
export function portfolioQuality(projects: PortfolioProject[]): PortfolioQuality {
  const rows: QualityRow[] = projects.map((p) => {
    const q = p.result.quality;
    if (p.result.state !== 'ok' || q === null) return { id: p.id, name: p.name, score: null, reason: p.result.notes[0] ?? 'Not worked out yet.', topProblem: null, tasks: p.result.tasks };
    const top = [...q.issueCounts].sort((a, b) => b.count - a.count)[0];
    return { id: p.id, name: p.name, score: q.score, reason: q.reading, topProblem: top ? `${top.count} × ${issueLabel(top.code as DataIssueCode)}` : null, tasks: p.result.tasks };
  });
  const scored = rows.filter((r) => r.score !== null);
  rows.sort((a, b) => (a.score === null ? 1 : 0) - (b.score === null ? 1 : 0) || (a.score ?? 0) - (b.score ?? 0) || a.name.localeCompare(b.name));
  const scores = scored.map((r) => r.score as number);
  return { rows, scored: scored.length, notScored: rows.length - scored.length, lowest: scores.length ? Math.min(...scores) : null, highest: scores.length ? Math.max(...scores) : null };
}
