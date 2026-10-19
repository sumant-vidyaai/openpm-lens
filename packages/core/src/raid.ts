import type { GridCell } from './csv';
import { parseDateText } from './dates';

/**
 * Risks, issues and changes (the "RAID" log, plus change control).
 * Everything here reads optional template sheets. Rules that apply throughout:
 * - a blank is "not known", never 0 and never guessed; rows that cannot be used are listed with the reason;
 * - a risk score is probability x impact on 1 to 5 scales (1 to 25). The score is an ordering aid, so scores are
 *   never added together; the band limits are starting values the user can change, not a standard;
 * - days are calendar days.
 */

const txt = (c: GridCell | undefined): string => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10);
  return String(c).trim();
};
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

/** Finds columns by (case-insensitive) heading so a re-ordered sheet still works. */
function columns(grid: GridCell[][], names: string[]): { idx: Record<string, number>; missing: string[] } {
  const head = (grid[0] ?? []).map((h) => txt(h).toLowerCase());
  const idx: Record<string, number> = {};
  const missing: string[] = [];
  for (const n of names) {
    const j = head.indexOf(n.toLowerCase());
    if (j < 0) missing.push(n); else idx[n] = j;
  }
  return { idx, missing };
}
const cell = (r: GridCell[], idx: Record<string, number>, n: string): string => (idx[n] === undefined ? '' : txt(r[idx[n]]));
const isBlankRow = (r: GridCell[]) => r.every((c) => txt(c) === '');
const dateOf = (s: string, label: string): { iso: string | null; bad: boolean } => {
  if (s === '') return { iso: null, bad: false };
  const iso = parseDateText(s, 'auto', label).iso;
  return { iso, bad: iso === null };
};

// ---------------------------------------------------------------- risks
export const RISK_STATUSES = ['Open', 'Closed', 'Occurred'] as const;
export type RiskStatus = 'open' | 'closed' | 'occurred';
export interface RiskInput {
  id: string; title: string; owner: string; response: string; action: string;
  probability: number | null; impact: number | null; status: RiskStatus | null;
  actionDue: string | null; actionDone: string | null;
}
export interface RiskParse { risks: RiskInput[]; problems: string[]; present: boolean }
export const RISK_COLUMNS = ['ID', 'Risk', 'Probability (1-5)', 'Impact (1-5)', 'Owner', 'Response', 'Status', 'Action', 'Action due', 'Action done'] as const;

const scale = (s: string): number | null => (/^[1-5]$/.test(s) ? Number(s) : /^[1-5]\.0+$/.test(s) ? Number(s) : null);

export function parseRisks(grid: GridCell[][] | undefined): RiskParse {
  if (grid === undefined) return { risks: [], problems: [], present: false };
  const { idx, missing } = columns(grid, [...RISK_COLUMNS]);
  const problems: string[] = [];
  if (idx['Risk'] === undefined) return { risks: [], problems: ['Risks: no "Risk" column was found, so the sheet was ignored.'], present: true };
  if (missing.length > 0) problems.push(`Risks: column${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}. Those values are treated as not known.`);
  const risks: RiskInput[] = [];
  grid.slice(1).forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const title = cell(r, idx, 'Risk');
    if (title === '') { problems.push(`Risks: row ${row} has no risk text and was ignored.`); return; }
    const pT = cell(r, idx, 'Probability (1-5)'), iT = cell(r, idx, 'Impact (1-5)');
    const probability = scale(pT), impact = scale(iT);
    if (pT !== '' && probability === null) problems.push(`Risks: row ${row} probability "${pT}" is not a whole number from 1 to 5; the risk is not scored.`);
    if (iT !== '' && impact === null) problems.push(`Risks: row ${row} impact "${iT}" is not a whole number from 1 to 5; the risk is not scored.`);
    const sT = cell(r, idx, 'Status').toLowerCase();
    const status = sT === 'open' ? 'open' : sT === 'closed' ? 'closed' : sT === 'occurred' ? 'occurred' : null;
    if (sT !== '' && status === null) problems.push(`Risks: row ${row} status "${cell(r, idx, 'Status')}" is not Open, Closed or Occurred; status not known.`);
    const due = dateOf(cell(r, idx, 'Action due'), 'risk action due');
    const done = dateOf(cell(r, idx, 'Action done'), 'risk action done');
    if (due.bad) problems.push(`Risks: row ${row} "Action due" is not a clear date (write year-month-day); ignored.`);
    if (done.bad) problems.push(`Risks: row ${row} "Action done" is not a clear date (write year-month-day); ignored.`);
    risks.push({
      id: cell(r, idx, 'ID') || `R${row - 1}`, title, owner: cell(r, idx, 'Owner'), response: cell(r, idx, 'Response'), action: cell(r, idx, 'Action'),
      probability, impact, status, actionDue: due.iso, actionDone: done.iso,
    });
  });
  return { risks, problems, present: true };
}

export type RiskBand = 'low' | 'medium' | 'high';
export const RISK_BAND_LABEL: Record<RiskBand, string> = { low: 'Low', medium: 'Medium', high: 'High' };
/** Starting values (from 7 is medium, from 13 is high), widely used for a 5 x 5 grid but not a standard. */
export const DEFAULT_RISK_BANDS = { mediumMin: 7, highMin: 13 } as const;

export interface RiskRow extends RiskInput {
  score: number | null;
  band: RiskBand | null;
  /** Open risk whose action date has passed without an "Action done" date. Null when it cannot be judged (no status date or no action date). */
  actionOverdueDays: number | null;
}
export interface RiskResult {
  /** Open (and not-known-status) scored risks first, highest score first; then the rest. */
  rows: RiskRow[];
  openCounts: Record<RiskBand, number>;
  /** Open risks that could not be scored. */
  openUnscored: number;
  closed: number;
  occurred: number;
  statusUnknown: number;
  /** Open risks with no owner / no response text. */
  openNoOwner: number;
  openNoResponse: number;
  overdueActions: number;
  /** heat[impact-1][probability-1] = number of open scored risks. */
  heat: number[][];
}

export function bandOf(score: number, mediumMin: number, highMin: number): RiskBand {
  return score >= highMin ? 'high' : score >= mediumMin ? 'medium' : 'low';
}

export function analyseRisks(risks: RiskInput[], statusDate: string | null, bands: { mediumMin: number; highMin: number } = DEFAULT_RISK_BANDS): RiskResult {
  const heat = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  const openCounts: Record<RiskBand, number> = { low: 0, medium: 0, high: 0 };
  let openUnscored = 0, closed = 0, occurred = 0, statusUnknown = 0, openNoOwner = 0, openNoResponse = 0, overdueActions = 0;
  const rows: RiskRow[] = risks.map((r) => {
    const score = r.probability !== null && r.impact !== null ? r.probability * r.impact : null;
    const band = score === null ? null : bandOf(score, bands.mediumMin, bands.highMin);
    let actionOverdueDays: number | null = null;
    const isOpen = r.status === 'open';
    if (isOpen && statusDate !== null && r.actionDue !== null && r.actionDone === null && r.actionDue < statusDate) actionOverdueDays = daysBetween(r.actionDue, statusDate);
    if (r.status === 'closed') closed += 1;
    else if (r.status === 'occurred') occurred += 1;
    else if (r.status === null) statusUnknown += 1;
    if (isOpen) {
      if (score === null || band === null) openUnscored += 1;
      else { openCounts[band] += 1; (heat[r.impact! - 1] as number[])[r.probability! - 1]! += 1; }
      if (r.owner === '') openNoOwner += 1;
      if (r.response === '' && r.action === '') openNoResponse += 1;
      if (actionOverdueDays !== null) overdueActions += 1;
    }
    return { ...r, score, band, actionOverdueDays };
  });
  const rank = (x: RiskRow) => (x.status === 'open' ? 0 : x.status === null ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id));
  return { rows, openCounts, openUnscored, closed, occurred, statusUnknown, openNoOwner, openNoResponse, overdueActions, heat };
}

// ---------------------------------------------------------------- issues
export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const ISSUE_STATUSES = ['Open', 'Resolved', 'Closed'] as const;
export type IssueStatus = 'open' | 'resolved' | 'closed';
export interface IssueInput {
  id: string; title: string; owner: string; priority: string | null; status: IssueStatus | null;
  raised: string | null; due: string | null; resolved: string | null;
}
export interface IssueParse { issues: IssueInput[]; problems: string[]; present: boolean }
export const ISSUE_COLUMNS = ['ID', 'Issue', 'Priority', 'Owner', 'Status', 'Raised', 'Due', 'Resolved'] as const;

export function parseIssues(grid: GridCell[][] | undefined): IssueParse {
  if (grid === undefined) return { issues: [], problems: [], present: false };
  const { idx, missing } = columns(grid, [...ISSUE_COLUMNS]);
  const problems: string[] = [];
  if (idx['Issue'] === undefined) return { issues: [], problems: ['Issues: no "Issue" column was found, so the sheet was ignored.'], present: true };
  if (missing.length > 0) problems.push(`Issues: column${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}. Those values are treated as not known.`);
  const issues: IssueInput[] = [];
  grid.slice(1).forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const title = cell(r, idx, 'Issue');
    if (title === '') { problems.push(`Issues: row ${row} has no issue text and was ignored.`); return; }
    const pT = cell(r, idx, 'Priority');
    const priority = ISSUE_PRIORITIES.find((p) => p.toLowerCase() === pT.toLowerCase()) ?? null;
    if (pT !== '' && priority === null) problems.push(`Issues: row ${row} priority "${pT}" is not Low, Medium, High or Critical; priority not known.`);
    const sT = cell(r, idx, 'Status').toLowerCase();
    const status = sT === 'open' ? 'open' : sT === 'resolved' ? 'resolved' : sT === 'closed' ? 'closed' : null;
    if (sT !== '' && status === null) problems.push(`Issues: row ${row} status "${cell(r, idx, 'Status')}" is not Open, Resolved or Closed; status not known.`);
    const raised = dateOf(cell(r, idx, 'Raised'), 'issue raised');
    const due = dateOf(cell(r, idx, 'Due'), 'issue due');
    const res = dateOf(cell(r, idx, 'Resolved'), 'issue resolved');
    for (const [d, n] of [[raised, 'Raised'], [due, 'Due'], [res, 'Resolved']] as const) {
      if (d.bad) problems.push(`Issues: row ${row} "${n}" is not a clear date (write year-month-day); ignored.`);
    }
    issues.push({ id: cell(r, idx, 'ID') || `I${row - 1}`, title, owner: cell(r, idx, 'Owner'), priority, status, raised: raised.iso, due: due.iso, resolved: res.iso });
  });
  return { issues, problems, present: true };
}

export interface IssueRow extends IssueInput {
  /** Open issues: days from Raised to the status date. Resolved or closed with both dates: days from Raised to Resolved. */
  days: number | null;
  /** Open and past its due date: days past due. */
  overdueDays: number | null;
}
export interface IssueResult {
  rows: IssueRow[];
  open: number; resolved: number; closed: number; statusUnknown: number;
  overdue: number;
  openNoDate: number;
  openNoOwner: number;
  /** Oldest open issue, in days; null if no open issue has a Raised date. */
  oldestOpen: number | null;
  /** Average of Raised-to-Resolved days over resolved/closed issues that have both dates. */
  averageDaysToResolve: number | null;
  resolvedWithDates: number;
  openByPriority: Record<string, number>;
}

export function analyseIssues(issues: IssueInput[], statusDate: string | null): IssueResult {
  let open = 0, resolved = 0, closed = 0, statusUnknown = 0, overdue = 0, openNoDate = 0, openNoOwner = 0;
  let oldestOpen: number | null = null;
  const solve: number[] = [];
  const openByPriority: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0, 'Not set': 0 };
  const rows: IssueRow[] = issues.map((x) => {
    let days: number | null = null;
    let overdueDays: number | null = null;
    if (x.status === 'open') {
      open += 1;
      openByPriority[x.priority ?? 'Not set'] = (openByPriority[x.priority ?? 'Not set'] ?? 0) + 1;
      if (x.owner === '') openNoOwner += 1;
      if (x.raised === null) openNoDate += 1;
      else if (statusDate !== null) {
        days = daysBetween(x.raised, statusDate);
        if (oldestOpen === null || days > oldestOpen) oldestOpen = days;
      }
      if (statusDate !== null && x.due !== null && x.due < statusDate) { overdueDays = daysBetween(x.due, statusDate); overdue += 1; }
    } else if (x.status === 'resolved' || x.status === 'closed') {
      if (x.status === 'resolved') resolved += 1; else closed += 1;
      if (x.raised !== null && x.resolved !== null) { days = daysBetween(x.raised, x.resolved); solve.push(days); }
    } else statusUnknown += 1;
    return { ...x, days, overdueDays };
  });
  const rank = (x: IssueRow) => (x.status === 'open' ? 0 : x.status === null ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? (b.days ?? -1) - (a.days ?? -1) : 0) || a.id.localeCompare(b.id));
  return {
    rows, open, resolved, closed, statusUnknown, overdue, openNoDate, openNoOwner, oldestOpen,
    averageDaysToResolve: solve.length === 0 ? null : solve.reduce((a, b) => a + b, 0) / solve.length,
    resolvedWithDates: solve.length, openByPriority,
  };
}

// ---------------------------------------------------------------- changes
export const CHANGE_DECISIONS = ['Requested', 'Approved', 'Rejected', 'Withdrawn'] as const;
export type ChangeDecision = 'requested' | 'approved' | 'rejected' | 'withdrawn';
export interface ChangeInput {
  id: string; title: string; requestedBy: string; decision: ChangeDecision | null;
  requested: string | null; decided: string | null;
  costHours: number | null; scheduleDays: number | null;
}
export interface ChangeParse { changes: ChangeInput[]; problems: string[]; present: boolean }
export const CHANGE_COLUMNS = ['ID', 'Change', 'Requested by', 'Decision', 'Requested', 'Decided', 'Cost impact (h)', 'Schedule impact (days)'] as const;

const signed = (s: string): number | null => (/^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : null);

export function parseChanges(grid: GridCell[][] | undefined): ChangeParse {
  if (grid === undefined) return { changes: [], problems: [], present: false };
  const { idx, missing } = columns(grid, [...CHANGE_COLUMNS]);
  const problems: string[] = [];
  if (idx['Change'] === undefined) return { changes: [], problems: ['Changes: no "Change" column was found, so the sheet was ignored.'], present: true };
  if (missing.length > 0) problems.push(`Changes: column${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}. Those values are treated as not known.`);
  const changes: ChangeInput[] = [];
  grid.slice(1).forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const title = cell(r, idx, 'Change');
    if (title === '') { problems.push(`Changes: row ${row} has no change text and was ignored.`); return; }
    const dT = cell(r, idx, 'Decision').toLowerCase();
    const decision = dT === 'requested' ? 'requested' : dT === 'approved' ? 'approved' : dT === 'rejected' ? 'rejected' : dT === 'withdrawn' ? 'withdrawn' : null;
    if (dT !== '' && decision === null) problems.push(`Changes: row ${row} decision "${cell(r, idx, 'Decision')}" is not Requested, Approved, Rejected or Withdrawn; decision not known.`);
    const req = dateOf(cell(r, idx, 'Requested'), 'change requested');
    const dec = dateOf(cell(r, idx, 'Decided'), 'change decided');
    if (req.bad) problems.push(`Changes: row ${row} "Requested" is not a clear date (write year-month-day); ignored.`);
    if (dec.bad) problems.push(`Changes: row ${row} "Decided" is not a clear date (write year-month-day); ignored.`);
    const cT = cell(r, idx, 'Cost impact (h)'), sT = cell(r, idx, 'Schedule impact (days)');
    const costHours = signed(cT), scheduleDays = signed(sT);
    if (cT !== '' && costHours === null) problems.push(`Changes: row ${row} cost impact "${cT}" is not a number of hours (write 40 or -8); not counted.`);
    if (sT !== '' && scheduleDays === null) problems.push(`Changes: row ${row} schedule impact "${sT}" is not a number of days (write 5 or -2); not counted.`);
    changes.push({ id: cell(r, idx, 'ID') || `C${row - 1}`, title, requestedBy: cell(r, idx, 'Requested by'), decision, requested: req.iso, decided: dec.iso, costHours, scheduleDays });
  });
  return { changes, problems, present: true };
}

export interface ChangeRow extends ChangeInput {
  /** Approved changes only: totals so far, in decided-date order (changes with no decided date come last). */
  runningHours: number | null;
  runningDays: number | null;
  /** Requested and still undecided: days since the request. */
  waitingDays: number | null;
}
export interface ChangeResult {
  rows: ChangeRow[];
  requested: number; approved: number; rejected: number; withdrawn: number; decisionUnknown: number;
  /** Sums over approved changes that state the impact. */
  approvedHours: number; approvedDays: number;
  approvedMissingHours: number; approvedMissingDays: number;
  /** Approved hours as a share of the original budget; null unless an original budget was entered. */
  scopeGrowthPercent: number | null;
  longestWaiting: number | null;
}

export function analyseChanges(changes: ChangeInput[], statusDate: string | null, originalBudgetHours: number | null): ChangeResult {
  const approvedList = changes.filter((c) => c.decision === 'approved').sort((a, b) => (a.decided ?? '9999').localeCompare(b.decided ?? '9999') || a.id.localeCompare(b.id));
  const run = new Map<ChangeInput, { h: number | null; d: number | null }>();
  let h = 0, d = 0, hMiss = 0, dMiss = 0, hAny = false, dAny = false;
  for (const c of approvedList) {
    if (c.costHours === null) hMiss += 1; else { h += c.costHours; hAny = true; }
    if (c.scheduleDays === null) dMiss += 1; else { d += c.scheduleDays; dAny = true; }
    run.set(c, { h: hAny ? h : null, d: dAny ? d : null });
  }
  let requested = 0, rejected = 0, withdrawn = 0, decisionUnknown = 0, longest: number | null = null;
  const rows: ChangeRow[] = changes.map((c) => {
    let waitingDays: number | null = null;
    if (c.decision === 'requested') {
      requested += 1;
      if (statusDate !== null && c.requested !== null) { waitingDays = daysBetween(c.requested, statusDate); if (longest === null || waitingDays > longest) longest = waitingDays; }
    } else if (c.decision === 'rejected') rejected += 1;
    else if (c.decision === 'withdrawn') withdrawn += 1;
    else if (c.decision === null) decisionUnknown += 1;
    const r = run.get(c);
    return { ...c, runningHours: r?.h ?? null, runningDays: r?.d ?? null, waitingDays, _src: c } as ChangeRow & { _src: ChangeInput };
  });
  const order = new Map<ChangeInput, number>(approvedList.map((c, i) => [c, i]));
  const src = (x: ChangeRow) => (x as ChangeRow & { _src: ChangeInput })._src;
  const rank = (x: ChangeRow) => (x.decision === 'approved' ? 0 : x.decision === 'requested' ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b)
    || (rank(a) === 0 ? (order.get(src(a)) ?? 0) - (order.get(src(b)) ?? 0) : (a.requested ?? '9999').localeCompare(b.requested ?? '9999'))
    || a.id.localeCompare(b.id));
  return {
    rows: rows.map(({ ...x }) => { delete (x as { _src?: ChangeInput })._src; return x; }), requested, approved: approvedList.length, rejected, withdrawn, decisionUnknown,
    approvedHours: h, approvedDays: d, approvedMissingHours: hMiss, approvedMissingDays: dMiss,
    scopeGrowthPercent: originalBudgetHours !== null && originalBudgetHours > 0 && approvedList.length > 0 ? (h / originalBudgetHours) * 100 : originalBudgetHours !== null && originalBudgetHours > 0 ? 0 : null,
    longestWaiting: longest,
  };
}
