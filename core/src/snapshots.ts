/**
 * Snapshots: a dated copy of the headline numbers, so a project can be compared with itself over time.
 * A snapshot holds totals only (hours, counts), never task names, so a saved file shows no project detail.
 * Nothing is estimated: a number that was not available when the snapshot was taken stays null.
 */
export const SNAPSHOT_FORMAT = 'openpm-lens-snapshot';

export interface SnapshotCounts { total: number; notStarted: number; inProgress: number; done: number; cancelled: number }
export interface SnapshotRaid {
  risksHigh: number | null; risksMedium: number | null; risksLow: number | null; risksUnscored: number | null;
  openIssues: number | null; approvedHours: number | null; approvedDays: number | null;
}
export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: 1;
  /** When the snapshot was saved (ISO timestamp). Trends are ordered by statusDate, not by this. */
  savedAt: string;
  /** Names the series (usually the project or file name). Snapshots with the same label are compared with each other. */
  label: string;
  statusDate: string;
  source: string;
  /** At most one snapshot per label is the baseline (the plan to compare against). */
  baseline: boolean;
  ev: number | null; ac: number | null; bac: number | null; pv: number | null; evSchedule: number | null;
  costTasks: number; scheduleTasks: number;
  counts: SnapshotCounts;
  openDefects: number | null;
  raid: SnapshotRaid | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (s: string) => { if (!ISO.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const numOrNull = (v: unknown): number | null | undefined => (v === null ? null : typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const count = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);

/** Checks something read from a file or from storage. It is never trusted: anything odd is refused with a reason. */
export function validateSnapshot(x: unknown): { snapshot: Snapshot | null; problem: string | null } {
  const bad = (p: string) => ({ snapshot: null, problem: p });
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return bad('This is not a snapshot (it is not an object).');
  const o = x as Record<string, unknown>;
  if (o['format'] !== SNAPSHOT_FORMAT) return bad('This is not an openpm-lens snapshot file.');
  if (o['version'] !== 1) return bad('This snapshot was made by a different version of the app and cannot be read.');
  const label = o['label'], statusDate = o['statusDate'], savedAt = o['savedAt'], source = o['source'];
  if (typeof label !== 'string' || label.trim() === '' || label.length > 120) return bad('The snapshot has no usable label.');
  if (typeof statusDate !== 'string' || !realDate(statusDate)) return bad('The snapshot has no valid status date.');
  if (typeof savedAt !== 'string' || savedAt.length > 40) return bad('The snapshot has no valid saved time.');
  const n: Record<string, number | null> = {};
  for (const k of ['ev', 'ac', 'bac', 'pv', 'evSchedule', 'openDefects']) {
    const v = numOrNull(o[k]);
    if (v === undefined) return bad(`The snapshot value "${k}" is not a number.`);
    n[k] = v;
  }
  const costTasks = count(o['costTasks']), scheduleTasks = count(o['scheduleTasks']);
  if (costTasks === undefined || scheduleTasks === undefined) return bad('The snapshot task counts are not valid.');
  const c = o['counts'] as Record<string, unknown> | null | undefined;
  if (typeof c !== 'object' || c === null) return bad('The snapshot has no status counts.');
  const counts = { total: count(c['total']), notStarted: count(c['notStarted']), inProgress: count(c['inProgress']), done: count(c['done']), cancelled: count(c['cancelled']) };
  if (Object.values(counts).some((v) => v === undefined)) return bad('The snapshot status counts are not valid.');
  let raid: SnapshotRaid | null = null;
  if (o['raid'] !== null && o['raid'] !== undefined) {
    const r = o['raid'] as Record<string, unknown>;
    if (typeof r !== 'object') return bad('The snapshot risk data is not valid.');
    const out: Record<string, number | null> = {};
    for (const k of ['risksHigh', 'risksMedium', 'risksLow', 'risksUnscored', 'openIssues', 'approvedHours', 'approvedDays']) {
      const v = numOrNull(r[k]);
      if (v === undefined) return bad(`The snapshot risk value "${k}" is not a number.`);
      out[k] = v;
    }
    raid = out as unknown as SnapshotRaid;
  }
  return {
    problem: null,
    snapshot: {
      format: SNAPSHOT_FORMAT, version: 1, savedAt, label: label.trim(), statusDate, source: typeof source === 'string' ? source.slice(0, 200) : '',
      baseline: o['baseline'] === true,
      ev: n['ev'] ?? null, ac: n['ac'] ?? null, bac: n['bac'] ?? null, pv: n['pv'] ?? null, evSchedule: n['evSchedule'] ?? null,
      costTasks, scheduleTasks, counts: counts as SnapshotCounts, openDefects: n['openDefects'] ?? null, raid,
    },
  };
}

export const snapshotId = (s: Pick<Snapshot, 'label' | 'statusDate'>) => `${s.label}\u0001${s.statusDate}`;

/** Adds a snapshot. The same label and status date replaces the older one (so saving twice does not double count). */
export function addSnapshot(list: Snapshot[], s: Snapshot): { list: Snapshot[]; replaced: boolean } {
  const id = snapshotId(s);
  const replaced = list.some((x) => snapshotId(x) === id);
  let next = [...list.filter((x) => snapshotId(x) !== id), s];
  if (s.baseline) next = next.map((x) => (x.label === s.label && snapshotId(x) !== id ? { ...x, baseline: false } : x));
  return { list: next, replaced };
}

/** Marks one snapshot as the baseline of its label (turning it off if it already was). Only one per label. */
export function toggleBaseline(list: Snapshot[], id: string): Snapshot[] {
  const target = list.find((x) => snapshotId(x) === id);
  if (!target) return list;
  return list.map((x) => (x.label !== target.label ? x : { ...x, baseline: snapshotId(x) === id ? !x.baseline : false }));
}

export const snapshotLabels = (list: Snapshot[]): string[] => [...new Set(list.map((s) => s.label))].sort((a, b) => a.localeCompare(b));
export const seriesOf = (list: Snapshot[], label: string): Snapshot[] => list.filter((s) => s.label === label).sort((a, b) => a.statusDate.localeCompare(b.statusDate));

const ratio = (num: number | null, den: number | null): number | null => (num !== null && den !== null && den > 0 ? num / den : null);
/** CPI = earned value / actual cost; SPI = earned value (schedule) / planned value. Null when the parts are missing or the divisor is 0. */
export const cpiOf = (s: Snapshot) => ratio(s.ev, s.ac);
export const spiOf = (s: Snapshot) => ratio(s.evSchedule, s.pv);

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
export const daysApart = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

export interface TrendPoint {
  date: string;
  cpi: number | null; spi: number | null;
  scope: number | null; earned: number | null; remaining: number | null;
  notStarted: number; inProgress: number; done: number;
  /** Tasks finished per week since the previous snapshot; null for the first, for a zero gap, or if the done count fell. */
  throughputPerWeek: number | null;
  openDefects: number | null;
  risksHigh: number | null; openRisks: number | null; openIssues: number | null;
}

export function trendPoints(series: Snapshot[]): TrendPoint[] {
  return series.map((s, i) => {
    const prev = i > 0 ? series[i - 1] : undefined;
    let throughputPerWeek: number | null = null;
    if (prev) {
      const days = daysApart(prev.statusDate, s.statusDate);
      const gained = s.counts.done - prev.counts.done;
      if (days > 0 && gained >= 0) throughputPerWeek = gained / (days / 7);
    }
    const r = s.raid;
    const openRisks = r && r.risksHigh !== null && r.risksMedium !== null && r.risksLow !== null ? r.risksHigh + r.risksMedium + r.risksLow + (r.risksUnscored ?? 0) : null;
    return {
      date: s.statusDate, cpi: cpiOf(s), spi: spiOf(s),
      scope: s.bac, earned: s.ev, remaining: s.bac !== null && s.ev !== null ? s.bac - s.ev : null,
      notStarted: s.counts.notStarted, inProgress: s.counts.inProgress, done: s.counts.done,
      throughputPerWeek, openDefects: s.openDefects, risksHigh: r?.risksHigh ?? null, openRisks, openIssues: r?.openIssues ?? null,
    };
  });
}

export interface CompareRow { key: string; label: string; unit: string; a: number | null; b: number | null; change: number | null }
export function compareSnapshots(a: Snapshot, b: Snapshot): { days: number; rows: CompareRow[] } {
  const row = (key: string, label: string, unit: string, x: number | null, y: number | null): CompareRow => ({ key, label, unit, a: x, b: y, change: x !== null && y !== null ? y - x : null });
  const ra = a.raid, rb = b.raid;
  return {
    days: daysApart(a.statusDate, b.statusDate),
    rows: [
      row('bac', 'Budget (planned hours)', 'h', a.bac, b.bac),
      row('pv', 'Planned value', 'h', a.pv, b.pv),
      row('ev', 'Earned value', 'h', a.ev, b.ev),
      row('ac', 'Actual cost', 'h', a.ac, b.ac),
      row('cpi', 'CPI', '', cpiOf(a), cpiOf(b)),
      row('spi', 'SPI', '', spiOf(a), spiOf(b)),
      row('total', 'Tasks (not cancelled)', '', a.counts.total - a.counts.cancelled, b.counts.total - b.counts.cancelled),
      row('done', 'Tasks done', '', a.counts.done, b.counts.done),
      row('wip', 'Tasks in progress', '', a.counts.inProgress, b.counts.inProgress),
      row('defects', 'Open defects', '', a.openDefects, b.openDefects),
      row('risksHigh', 'Open high risks', '', ra?.risksHigh ?? null, rb?.risksHigh ?? null),
      row('issues', 'Open issues', '', ra?.openIssues ?? null, rb?.openIssues ?? null),
      row('changes', 'Approved change hours', 'h', ra?.approvedHours ?? null, rb?.approvedHours ?? null),
    ],
  };
}

/** Whole days since the latest snapshot's status date; null with no snapshots or a status date in the future. */
export function daysSinceUpdate(series: Snapshot[], today: string): number | null {
  const last = series[series.length - 1];
  if (!last) return null;
  const d = daysApart(last.statusDate, today);
  return d >= 0 ? d : null;
}
