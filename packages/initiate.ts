import type { GridCell } from './csv';
import { parseDateText } from './dates';
/**
 * Initiate: choosing between options, the business case, who matters, and the go / no-go record.
 * Every judgement value (weights, scores, discount rate, "high" cut-offs) is typed in by the user; the app never supplies one.
 * Formulas checked against published guides:
 *   weighted score  = sum(weight x score)                       (weights ideally add to 100%; here divided by the weight total so any scale works)
 *   NPV             = sum( cash flow_t / (1 + r)^t ), t = 0 is not discounted   (same as: sum of discounted inflows - initial cost)
 *   power / interest grid: high/high manage closely, high power/low interest keep satisfied, low power/high interest keep informed, low/low monitor.
 */

/* ---------- weighted scoring (vendors or options) ---------- */
export interface Criterion { name: string; weight: number | null }
export interface OptionScores { option: string; scores: Record<string, number | null> }
export interface OptionResult {
  option: string;
  /** Weighted score on the same scale as the scores; null when any weighted criterion has no score. */
  score: number | null;
  missing: string[];
  rank: number | null;
}
export interface ScoringResult { weightTotal: number; criteriaUsed: number; ignored: string[]; options: OptionResult[] }

export function scoreOptions(criteria: readonly Criterion[], options: readonly OptionScores[]): ScoringResult {
  const used = criteria.filter((c) => c.weight !== null && Number.isFinite(c.weight) && c.weight > 0);
  const ignored = criteria.filter((c) => !used.includes(c)).map((c) => c.name);
  const weightTotal = used.reduce((s, c) => s + (c.weight as number), 0);
  const results: OptionResult[] = options.map((o) => {
    const missing = used.filter((c) => { const v = o.scores[c.name]; return v === null || v === undefined || !Number.isFinite(v); }).map((c) => c.name);
    const score = weightTotal > 0 && missing.length === 0
      ? used.reduce((s, c) => s + (c.weight as number) * (o.scores[c.name] as number), 0) / weightTotal
      : null;
    return { option: o.option, score, missing, rank: null };
  });
  const ranked = results.filter((r) => r.score !== null).sort((a, b) => (b.score as number) - (a.score as number));
  let lastScore: number | null = null; let lastRank = 0;
  ranked.forEach((r, i) => { if (lastScore === null || Math.abs((r.score as number) - lastScore) > 1e-9) { lastRank = i + 1; lastScore = r.score; } r.rank = lastRank; });
  return { weightTotal, criteriaUsed: used.length, ignored, options: results };
}

/* ---------- business case ---------- */
export interface CaseYear { period: number; cost: number | null; benefit: number | null }
export interface BusinessCase {
  periods: number;
  totalCost: number;
  totalBenefit: number;
  netTotal: number;
  /** (benefit - cost) / cost, not discounted; null when total cost is 0. */
  roi: number | null;
  /** Needs a discount rate: */
  npv: number | null;
  pvBenefit: number | null;
  pvCost: number | null;
  bcr: number | null;
  /** Periods until the running net total first reaches 0 (fractions by straight-line inside the period); null if never. */
  payback: number | null;
  discountedPayback: number | null;
  irr: number | null;
}

function paybackOf(net: number[]): number | null {
  let cum = 0;
  for (let t = 0; t < net.length; t++) {
    const prev = cum; cum += net[t] as number;
    if (cum >= 0 && t > 0 && prev < 0) return t - 1 + (-prev) / (net[t] as number);
    if (cum >= 0 && t === 0 && (net[0] as number) >= 0 && net.length > 0) return 0;
  }
  return null;
}
const npvOf = (net: number[], r: number) => net.reduce((s, v, t) => s + v / Math.pow(1 + r, t), 0);

function irrOf(net: number[]): number | null {
  const hasPos = net.some((v) => v > 0), hasNeg = net.some((v) => v < 0);
  if (!hasPos || !hasNeg) return null;
  let lo = -0.99, hi = 10;
  let flo = npvOf(net, lo), fhi = npvOf(net, hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npvOf(net, mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Year rows may come in any order; missing amounts count as 0; period 0 is today and is not discounted. discountRate is a fraction (0.08 = 8%) or null. */
export function businessCase(years: readonly CaseYear[], discountRate: number | null): BusinessCase | null {
  const rows = years.filter((y) => Number.isInteger(y.period) && y.period >= 0);
  if (rows.length === 0) return null;
  const last = Math.max(...rows.map((y) => y.period));
  const cost = new Array<number>(last + 1).fill(0), benefit = new Array<number>(last + 1).fill(0);
  for (const y of rows) { cost[y.period] = (cost[y.period] as number) + (y.cost ?? 0); benefit[y.period] = (benefit[y.period] as number) + (y.benefit ?? 0); }
  const net = benefit.map((b, i) => b - (cost[i] as number));
  const totalCost = cost.reduce((a, b) => a + b, 0), totalBenefit = benefit.reduce((a, b) => a + b, 0);
  const r = discountRate !== null && Number.isFinite(discountRate) && discountRate > -1 ? discountRate : null;
  const pv = (a: number[]) => (r === null ? null : a.reduce((s, v, t) => s + v / Math.pow(1 + r, t), 0));
  const pvB = pv(benefit), pvC = pv(cost);
  let dp: number | null = null;
  if (r !== null) dp = paybackOf(net.map((v, t) => v / Math.pow(1 + r, t)));
  return {
    periods: last + 1, totalCost, totalBenefit, netTotal: totalBenefit - totalCost,
    roi: totalCost > 0 ? (totalBenefit - totalCost) / totalCost : null,
    npv: r === null ? null : npvOf(net, r), pvBenefit: pvB, pvCost: pvC,
    bcr: pvC !== null && pvC > 0 && pvB !== null ? pvB / pvC : null,
    payback: paybackOf(net), discountedPayback: dp, irr: irrOf(net),
  };
}

/* ---------- stakeholder power / interest grid ---------- */
export type GridQuadrant = 'manage_closely' | 'keep_satisfied' | 'keep_informed' | 'monitor';
export const QUADRANT_LABEL: Record<GridQuadrant, string> = {
  manage_closely: 'Manage closely', keep_satisfied: 'Keep satisfied', keep_informed: 'Keep informed', monitor: 'Monitor',
};
/** power and interest are the user's scores; `highFrom` is the score at or above which they call it "high". Any missing value gives null. */
export function gridQuadrant(power: number | null, interest: number | null, highFrom: number | null): GridQuadrant | null {
  if (power === null || interest === null || highFrom === null) return null;
  const hp = power >= highFrom, hi = interest >= highFrom;
  return hp ? (hi ? 'manage_closely' : 'keep_satisfied') : (hi ? 'keep_informed' : 'monitor');
}

/* ---------- RFI / RFP tracker ---------- */
export interface Solicitation { id: string; kind: string; vendor: string; due: string | null; received: string | null; status: string | null }
export interface SolicitationSummary { total: number; received: number; open: number; overdue: number; noDue: number }
/** Overdue = no reply yet and the due date is before the status date (both yyyy-mm-dd text; text compares correctly in that form). */
export function summariseSolicitations(rows: readonly Solicitation[], statusDate: string | null): SolicitationSummary {
  let received = 0, overdue = 0, noDue = 0;
  for (const r of rows) {
    if (r.received) { received++; continue; }
    if (!r.due) noDue++;
    else if (statusDate && r.due < statusDate) overdue++;
  }
  return { total: rows.length, received, open: rows.length - received, overdue, noDue };
}

/* ---------- go / no-go record ---------- */
export type GoDecision = 'go' | 'no_go' | 'hold';
export interface GoRecord { decision: GoDecision | null; decidedBy: string | null; date: string | null; reason: string | null }
/** Returns what is still missing from a decision record; an empty list means it is complete. A "no go" or "hold" must say why. */
export function goRecordGaps(r: GoRecord): string[] {
  const g: string[] = [];
  if (!r.decision) g.push('decision');
  if (!r.decidedBy) g.push('who decided');
  if (!r.date) g.push('date');
  if ((r.decision === 'no_go' || r.decision === 'hold') && !r.reason) g.push('reason');
  return g;
}

/* ---------- reading the optional template sheets ---------- */

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
const colIdx = (grid: GridCell[][], name: string) => (grid[0] ?? []).map((h) => t_(h).toLowerCase()).indexOf(name.toLowerCase());
const dateField = (s: string): { iso: string | null; bad: boolean } => (s === '' ? { iso: null, bad: false } : (() => { const iso = parseDateText(s, 'auto', 'date').iso; return { iso, bad: iso === null }; })());

export interface ScoringParse { criteria: Criterion[]; options: OptionScores[]; problems: string[]; present: boolean }
/**
 * "Scoring" sheet: row 1 = "Option" then one criterion name per column; row 2 = "Weight" then each weight; rows 3 on = one option per row with its scores.
 * Weights must be positive numbers; scores any number (the user's own scale). Blank stays blank.
 */
export function parseScoring(grid: GridCell[][] | undefined): ScoringParse {
  if (grid === undefined) return { criteria: [], options: [], problems: [], present: false };
  const problems: string[] = [];
  const head = grid[0] ?? [], wrow = grid[1] ?? [];
  const cols: { j: number; name: string; weight: number | null }[] = [];
  for (let j = 1; j < head.length; j++) {
    const name = t_(head[j]);
    if (name === '') continue;
    const wText = t_(wrow[j]);
    const w = n_(wrow[j]);
    if (wText !== '' && (w === null || !(w > 0))) problems.push(`Scoring: weight "${wText}" for "${name}" is not a positive number; the criterion is left out.`);
    cols.push({ j, name, weight: w !== null && w > 0 ? w : null });
  }
  const options: OptionScores[] = [];
  grid.slice(2).forEach((r, i) => {
    if (blank(r)) return;
    const option = t_(r[0]);
    if (option === '') { problems.push(`Scoring: row ${i + 3} has scores but no option name and was ignored.`); return; }
    const scores: Record<string, number | null> = {};
    for (const c of cols) {
      const s = t_(r[c.j]);
      const v = n_(r[c.j]);
      if (s !== '' && v === null) problems.push(`Scoring: "${option}" / "${c.name}" is "${s}", not a number; treated as not scored.`);
      scores[c.name] = v;
    }
    options.push({ option, scores });
  });
  return { criteria: cols.map((c) => ({ name: c.name, weight: c.weight })), options, problems, present: true };
}

export interface CaseParse { years: CaseYear[]; problems: string[]; present: boolean }
/** "Business case" sheet: Period (0, 1, 2 ...), Cost, Benefit. Period 0 is today and is not discounted. */
export function parseCaseSheet(grid: GridCell[][] | undefined): CaseParse {
  if (grid === undefined) return { years: [], problems: [], present: false };
  const iP = colIdx(grid, 'Period'), iC = colIdx(grid, 'Cost'), iB = colIdx(grid, 'Benefit');
  if (iP < 0) return { years: [], problems: ['Business case: no "Period" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const years: CaseYear[] = [];
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const row = i + 2;
    const p = n_(r[iP]);
    if (p === null || !Number.isInteger(p) || p < 0) { problems.push(`Business case: row ${row} period "${t_(r[iP])}" is not a whole number from 0; the row was ignored.`); return; }
    const amt = (j: number, what: string) => {
      if (j < 0) return null;
      const s = t_(r[j]); const v = n_(r[j]);
      if (s !== '' && v === null) problems.push(`Business case: row ${row} ${what} "${s}" is not a number; treated as blank (counted as 0).`);
      return v;
    };
    years.push({ period: p, cost: amt(iC, 'cost'), benefit: amt(iB, 'benefit') });
  });
  return { years, problems, present: true };
}

export interface Stakeholder { name: string; role: string; power: number | null; interest: number | null; note: string }
export interface StakeholderParse { stakeholders: Stakeholder[]; problems: string[]; present: boolean }
/** "Stakeholders" sheet: Name, Role, Power (1-5), Interest (1-5), Note. */
export function parseStakeholders(grid: GridCell[][] | undefined): StakeholderParse {
  if (grid === undefined) return { stakeholders: [], problems: [], present: false };
  const iN = colIdx(grid, 'Name'), iR = colIdx(grid, 'Role'), iP = colIdx(grid, 'Power (1-5)'), iI = colIdx(grid, 'Interest (1-5)'), iT = colIdx(grid, 'Note');
  if (iN < 0) return { stakeholders: [], problems: ['Stakeholders: no "Name" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const out: Stakeholder[] = [];
  const scale = (r: GridCell[], j: number, what: string, who: string): number | null => {
    if (j < 0) return null;
    const s = t_(r[j]); if (s === '') return null;
    const v = n_(r[j]);
    if (v === null || !Number.isInteger(v) || v < 1 || v > 5) { problems.push(`Stakeholders: ${who} ${what} "${s}" is not a whole number from 1 to 5; not placed on the grid.`); return null; }
    return v;
  };
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const name = t_(r[iN]);
    if (name === '') { problems.push(`Stakeholders: row ${i + 2} has no name and was ignored.`); return; }
    out.push({ name, role: iR < 0 ? '' : t_(r[iR]), power: scale(r, iP, 'power', name), interest: scale(r, iI, 'interest', name), note: iT < 0 ? '' : t_(r[iT]) });
  });
  return { stakeholders: out, problems, present: true };
}

export interface SolicitationParse { rows: Solicitation[]; problems: string[]; present: boolean }
/** "RFI-RFP" sheet: ID, Type (RFI or RFP), Vendor, Due, Received, Status. */
export function parseSolicitations(grid: GridCell[][] | undefined): SolicitationParse {
  if (grid === undefined) return { rows: [], problems: [], present: false };
  const iI = colIdx(grid, 'ID'), iK = colIdx(grid, 'Type'), iV = colIdx(grid, 'Vendor'), iD = colIdx(grid, 'Due'), iR = colIdx(grid, 'Received'), iS = colIdx(grid, 'Status');
  if (iV < 0) return { rows: [], problems: ['RFI-RFP: no "Vendor" column was found, so the sheet was ignored.'], present: true };
  const problems: string[] = [];
  const rows: Solicitation[] = [];
  grid.slice(1).forEach((r, i) => {
    if (blank(r)) return;
    const row = i + 2;
    const vendor = t_(r[iV]);
    if (vendor === '') { problems.push(`RFI-RFP: row ${row} has no vendor and was ignored.`); return; }
    const due = iD < 0 ? { iso: null, bad: false } : dateField(t_(r[iD]));
    const rec = iR < 0 ? { iso: null, bad: false } : dateField(t_(r[iR]));
    if (due.bad) problems.push(`RFI-RFP: row ${row} "Due" is not a clear date (write year-month-day); ignored.`);
    if (rec.bad) problems.push(`RFI-RFP: row ${row} "Received" is not a clear date (write year-month-day); ignored.`);
    rows.push({ id: (iI < 0 ? '' : t_(r[iI])) || `S${row - 1}`, kind: iK < 0 ? '' : t_(r[iK]), vendor, due: due.iso, received: rec.iso, status: iS < 0 ? null : t_(r[iS]) || null });
  });
  return { rows, problems, present: true };
}

export interface GoParse { record: GoRecord | null; problems: string[]; present: boolean }
/** "Go-no-go" sheet: one row under the headings Decision (Go, No go or Hold), Decided by, Date, Reason. */
export function parseGoRecord(grid: GridCell[][] | undefined): GoParse {
  if (grid === undefined) return { record: null, problems: [], present: false };
  const iD = colIdx(grid, 'Decision'), iB = colIdx(grid, 'Decided by'), iT = colIdx(grid, 'Date'), iR = colIdx(grid, 'Reason');
  const r = grid.slice(1).find((x) => !blank(x));
  if (iD < 0 || !r) return { record: null, problems: iD < 0 ? ['Go-no-go: no "Decision" column was found, so the sheet was ignored.'] : [], present: true };
  const problems: string[] = [];
  const d = t_(r[iD]).toLowerCase().replace(/[\s-]+/g, '');
  const decision: GoDecision | null = d === 'go' ? 'go' : d === 'nogo' ? 'no_go' : d === 'hold' ? 'hold' : null;
  if (d !== '' && decision === null) problems.push(`Go-no-go: decision "${t_(r[iD])}" is not Go, No go or Hold; left blank.`);
  const date = iT < 0 ? { iso: null, bad: false } : dateField(t_(r[iT]));
  if (date.bad) problems.push('Go-no-go: "Date" is not a clear date (write year-month-day); ignored.');
  return { record: { decision, decidedBy: iB < 0 ? null : t_(r[iB]) || null, date: date.iso, reason: iR < 0 ? null : t_(r[iR]) || null }, problems, present: true };
}
