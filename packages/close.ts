import type { GridCell } from './csv';
import { parseDateText } from './dates';

/**
 * Close: benefits promised vs realised, the closure checklist and the lessons-learned register.
 * Benefit comparison follows the earned-benefit idea in a PMI paper: Benefit Performance Index (BPI) = realised / planned,
 * Benefit Variance (BV) = realised - planned. Worked example from the paper: realised 370,000, planned 404,000 -> BPI 0.916, BV -34,000.
 * A benefit with no realised figure is "not measured yet" and is left out of totals (never counted as 0). Benefits are only added when their Measure text matches (same unit); otherwise no total is given. Ratios are never averaged:
 * the total BPI is total realised / total planned over the measured benefits only.
 */

/* ---------- reading ---------- */
const t_ = (c: GridCell | undefined): string => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10);
  return String(c).trim();
};
const n_ = (c: GridCell | undefined): number | null => {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  const s = t_(c);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
const blank = (r: GridCell[]) => r.every((c) => t_(c) === '');
const idx = (grid: GridCell[][], name: string) => (grid[0] ?? []).map((h) => t_(h).toLowerCase()).indexOf(name.toLowerCase());
const dateOf = (s: string): { iso: string | null; bad: boolean } => (s === '' ? { iso: null, bad: false } : (() => { const iso = parseDateText(s, 'auto', 'date').iso; return { iso, bad: iso === null }; })());

export interface Benefit { id: string; name: string; owner: string; measure: string; planned: number | null; realised: number | null; due: string | null }
export interface BenefitParse { benefits: Benefit[]; problems: string[]; present: boolean }
/** "Benefits" sheet: ID, Benefit, Owner, Measure (what is counted, e.g. hours saved a month), Planned, Realised, Due. */
export function parseBenefits(grid: GridCell[][] | undefined): BenefitParse {
  if (grid === undefined) return { benefits: [], problems: [], present: false };
  const iI = idx(grid, 'ID'), iB = idx(grid, 'Benefit'), iO = idx(grid, 'Owner'), iM = idx(grid, 'Measure'), iP = idx(grid, 'Planned'), iR = idx(grid, 'Realised'), iD = idx(grid, 'Due');
  if (iB < 0) return { benefits: [], problems: ['Benefits: no "Benefit" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const benefits: Benefit[] = [];
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const row = i + 2;
    const name = t_(r[iB]);
    if (name === '') { problems.push(`Benefits: row ${row} has no benefit text and was ignored.`); return; }
    const amt = (j: number, what: string) => {
      if (j < 0) return null;
      const s = t_(r[j]), v = n_(r[j]);
      if (s !== '' && v === null) problems.push(`Benefits: row ${row} ${what} "${s}" is not a number; treated as not known.`);
      return v;
    };
    const due = iD < 0 ? { iso: null, bad: false } : dateOf(t_(r[iD]));
    if (due.bad) problems.push(`Benefits: row ${row} "Due" is not a clear date (write year-month-day); ignored.`);
    benefits.push({ id: (iI < 0 ? '' : t_(r[iI])) || `B${row - 1}`, name, owner: iO < 0 ? '' : t_(r[iO]), measure: iM < 0 ? '' : t_(r[iM]), planned: amt(iP, 'planned'), realised: amt(iR, 'realised'), due: due.iso });
  });
  return { benefits, problems, present: true };
}

export const CHECK_STATUSES = ['Open', 'Done', 'Not applicable'] as const;
export type CheckStatus = 'open' | 'done' | 'na';
export interface CheckItem { item: string; group: string; owner: string; status: CheckStatus | null; doneOn: string | null }
export interface ChecklistParse { items: CheckItem[]; problems: string[]; present: boolean }
/** "Checklist" sheet: Group (for example Go-live, Acceptance, Contract closure), Item, Owner, Status (Open, Done or Not applicable), Done on. */
export function parseChecklist(grid: GridCell[][] | undefined): ChecklistParse {
  if (grid === undefined) return { items: [], problems: [], present: false };
  const iG = idx(grid, 'Group'), iT = idx(grid, 'Item'), iO = idx(grid, 'Owner'), iS = idx(grid, 'Status'), iD = idx(grid, 'Done on');
  if (iT < 0) return { items: [], problems: ['Checklist: no "Item" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const items: CheckItem[] = [];
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const row = i + 2;
    const item = t_(r[iT]);
    if (item === '') { problems.push(`Checklist: row ${row} has no item text and was ignored.`); return; }
    const sText = iS < 0 ? '' : t_(r[iS]).toLowerCase();
    const status: CheckStatus | null = sText === 'open' ? 'open' : sText === 'done' ? 'done' : sText === 'not applicable' || sText === 'n/a' || sText === 'na' ? 'na' : null;
    if (sText !== '' && status === null) problems.push(`Checklist: row ${row} status "${t_(r[iS])}" is not Open, Done or Not applicable; treated as not known.`);
    const done = iD < 0 ? { iso: null, bad: false } : dateOf(t_(r[iD]));
    if (done.bad) problems.push(`Checklist: row ${row} "Done on" is not a clear date (write year-month-day); ignored.`);
    items.push({ item, group: (iG < 0 ? '' : t_(r[iG])) || 'General', owner: iO < 0 ? '' : t_(r[iO]), status, doneOn: done.iso });
  });
  return { items, problems, present: true };
}

export interface Lesson { category: string; lesson: string; recommendation: string; owner: string; raised: string | null }
export interface LessonParse { lessons: Lesson[]; problems: string[]; present: boolean }
/** "Lessons" sheet: Category (Went well, Went badly, Do differently), Lesson, Recommendation, Owner, Raised. */
export function parseLessons(grid: GridCell[][] | undefined): LessonParse {
  if (grid === undefined) return { lessons: [], problems: [], present: false };
  const iC = idx(grid, 'Category'), iL = idx(grid, 'Lesson'), iR = idx(grid, 'Recommendation'), iO = idx(grid, 'Owner'), iD = idx(grid, 'Raised');
  if (iL < 0) return { lessons: [], problems: ['Lessons: no "Lesson" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const lessons: Lesson[] = [];
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const row = i + 2;
    const lesson = t_(r[iL]);
    if (lesson === '') { problems.push(`Lessons: row ${row} has no lesson text and was ignored.`); return; }
    const d = iD < 0 ? { iso: null, bad: false } : dateOf(t_(r[iD]));
    if (d.bad) problems.push(`Lessons: row ${row} "Raised" is not a clear date (write year-month-day); ignored.`);
    lessons.push({ category: (iC < 0 ? '' : t_(r[iC])) || 'Uncategorised', lesson, recommendation: iR < 0 ? '' : t_(r[iR]), owner: iO < 0 ? '' : t_(r[iO]), raised: d.iso });
  });
  return { lessons, problems, present: true };
}

/* ---------- calculating ---------- */
export type BenefitState = 'not_measured' | 'no_plan' | 'behind' | 'on_plan' | 'ahead';
export interface BenefitRow extends Benefit {
  /** Realised / planned; null if either is missing or planned is 0. */
  bpi: number | null;
  /** Realised - planned; null if either is missing. */
  variance: number | null;
  state: BenefitState;
}
export interface BenefitSummary {
  rows: BenefitRow[];
  measured: number;
  notMeasured: number;
  /** Totals over the measured benefits that also have a plan. */
  planned: number | null;
  realised: number | null;
  bpi: number | null;
  variance: number | null;
  /** True when the benefits that could be totalled are measured in different units (the Measure column differs), so no total or index is given. */
  mixedUnits: boolean;
  /** Measured and planned, but realised is below planned. */
  behind: number;
}
export function summariseBenefits(list: readonly Benefit[]): BenefitSummary {
  const rows: BenefitRow[] = list.map((b) => {
    const both = b.planned !== null && b.realised !== null;
    const bpi = both && (b.planned as number) !== 0 ? (b.realised as number) / (b.planned as number) : null;
    const variance = both ? (b.realised as number) - (b.planned as number) : null;
    const state: BenefitState = b.realised === null ? 'not_measured' : b.planned === null ? 'no_plan' : (b.realised as number) < (b.planned as number) ? 'behind' : (b.realised as number) > (b.planned as number) ? 'ahead' : 'on_plan';
    return { ...b, bpi, variance, state };
  });
  const used = rows.filter((r) => r.planned !== null && r.realised !== null);
  const mixedUnits = new Set(used.map((r) => r.measure.trim().toLowerCase())).size > 1;
  const planned = used.length && !mixedUnits ? used.reduce((s, r) => s + (r.planned as number), 0) : null;
  const realised = used.length && !mixedUnits ? used.reduce((s, r) => s + (r.realised as number), 0) : null;
  return {
    rows, measured: rows.filter((r) => r.realised !== null).length, notMeasured: rows.filter((r) => r.realised === null).length,
    planned, realised, bpi: planned !== null && planned !== 0 ? (realised as number) / planned : null,
    variance: planned !== null ? (realised as number) - planned : null, mixedUnits, behind: rows.filter((r) => r.state === 'behind').length,
  };
}

export interface CheckGroup { group: string; done: number; open: number; unknown: number; notApplicable: number; applicable: number }
export interface ChecklistSummary { groups: CheckGroup[]; done: number; applicable: number; open: CheckItem[] }
/** Applicable = everything except "Not applicable". An item with no status is "not known" and counts as not done. */
export function summariseChecklist(items: readonly CheckItem[]): ChecklistSummary {
  const map = new Map<string, CheckGroup>();
  for (const it of items) {
    const g = map.get(it.group) ?? { group: it.group, done: 0, open: 0, unknown: 0, notApplicable: 0, applicable: 0 };
    if (it.status === 'done') g.done++; else if (it.status === 'na') g.notApplicable++; else if (it.status === 'open') g.open++; else g.unknown++;
    g.applicable = g.done + g.open + g.unknown;
    map.set(it.group, g);
  }
  const groups = [...map.values()];
  return { groups, done: groups.reduce((s, g) => s + g.done, 0), applicable: groups.reduce((s, g) => s + g.applicable, 0), open: items.filter((i) => i.status !== 'done' && i.status !== 'na') };
}
