import { forecast, type EacMethod, type ForecastResult } from './forecast';
import { costPerformanceIndex, costVariance } from './evm';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';
import { splitPeople } from './resource';

/**
 * Cost in money: hours x an hourly rate that YOU enter.
 *
 * No rate is ever looked up or guessed. One currency only, no conversion. A task is priced with the
 * rate for its assigned person if you gave one, otherwise your default rate if you gave one; with
 * neither it is left out and listed. A task naming several people (separated by ";") is priced with the
 * default rate only when no named person has an own rate (otherwise the split is unknown: left out).
 * Money EV, AC and BAC use the same task rules as the hours version.
 */
export interface MoneyTask {
  id: string;
  assignee: string | null;
  plannedHours: number | null;
  actualHours: number | null;
  percentComplete: number | null;
}

export interface RateTable {
  /** Cost per hour for anyone without an own rate; null = none. */
  defaultRate: number | null;
  /** Cost per hour by person (exact name as in the file, ignoring case and spacing). */
  byPerson: Record<string, number>;
}

export interface MoneyExcluded { id: string; reason: string }
export interface MoneyResult {
  ev: number | null;
  ac: number | null;
  bac: number | null;
  cpi: number | null;
  cv: number | null;
  /** CPI in hours over the same tasks, to compare with the money CPI. */
  hoursCpi: number | null;
  used: number;
  total: number;
  excluded: MoneyExcluded[];
  caveats: string[];
  steps: StepGroup[];
  /** Per-task money, in the order given (null when left out). */
  rows: { id: string; rate: number | null; ev: number | null; ac: number | null; bac: number | null; note: string }[];
}

const fin = (n: number | null): n is number => n !== null && Number.isFinite(n);
const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function validRate(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

export function analyseMoney(tasks: MoneyTask[], rates: RateTable): MoneyResult {
  const byKey = new Map(Object.entries(rates.byPerson).filter(([, v]) => validRate(v)).map(([k, v]) => [key(k), v]));
  const dflt = rates.defaultRate !== null && validRate(rates.defaultRate) ? rates.defaultRate : null;
  const excluded: MoneyExcluded[] = [];
  const rows: MoneyResult['rows'] = [];
  let ev = 0, ac = 0, bac = 0, evH = 0, acH = 0, used = 0;
  for (const t of tasks) {
    const left = (reason: string) => { excluded.push({ id: t.id, reason }); rows.push({ id: t.id, rate: null, ev: null, ac: null, bac: null, note: `Left out: ${reason}` }); };
    if (!fin(t.plannedHours)) { left('no planned hours'); continue; }
    if (!fin(t.actualHours)) { left('no actual hours'); continue; }
    if (!fin(t.percentComplete)) { left('no % complete'); continue; }
    const people = splitPeople(t.assignee);
    let rate: number | null = null;
    if (people.length === 1) rate = byKey.get(key(people[0] as string)) ?? dflt;
    else if (people.length === 0) rate = dflt;
    else if (people.some((p) => byKey.has(key(p)))) { left('several people named and at least one has an own rate: split not known'); continue; }
    else rate = dflt;
    if (rate === null) { left(people.length === 0 ? 'nobody assigned and no default rate' : `no rate for ${people.join('; ')} and no default rate`); continue; }
    const tEv = t.plannedHours * (t.percentComplete / 100) * rate;
    const tAc = t.actualHours * rate;
    const tBac = t.plannedHours * rate;
    ev += tEv; ac += tAc; bac += tBac; used += 1;
    evH += t.plannedHours * (t.percentComplete / 100); acH += t.actualHours;
    rows.push({ id: t.id, rate, ev: tEv, ac: tAc, bac: tBac, note: 'Used' });
  }
  const caveats: string[] = [];
  if (excluded.length > 0) caveats.push(`${excluded.length} of ${tasks.length} tasks left out (see the list).`);
  const none = used === 0;
  const cpi = none ? null : costPerformanceIndex(ev, ac);
  const hoursCpi = none ? null : costPerformanceIndex(evH, acH);
  if (!none && cpi !== null && hoursCpi !== null && Math.abs(cpi - hoursCpi) > 1e-9) {
    caveats.push('The CPI in money differs from the CPI in hours because the people have different rates.');
  }
  const n = (x: number | null, d = 2) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const steps: StepGroup[] = none ? [] : [
    { label: 'Money values', steps: ['Each task: rate = the person\'s rate, else your default rate', 'EV = sum of (planned hours x % complete x rate); AC = sum of (actual hours x rate); BAC = sum of (planned hours x rate)', `EV = ${n(ev)}; AC = ${n(ac)}; BAC = ${n(bac)}`] },
    { label: 'Cost performance index (CPI)', steps: ['CPI = EV / AC', `CPI = ${n(ev)} / ${n(ac)}`, `CPI = ${n(cpi, 4)}`] },
    { label: 'Cost variance (CV)', steps: ['CV = EV - AC', `CV = ${n(ev)} - ${n(ac)} = ${n(ev - ac)}`] },
  ];
  return {
    ev: none ? null : ev, ac: none ? null : ac, bac: none ? null : bac, cpi, cv: none ? null : costVariance(ev, ac),
    hoursCpi, used, total: tasks.length, excluded, caveats, steps, rows,
  };
}

/** Forecast in money (EAC etc.), using the same method choices as the hours forecast. */
export function forecastMoney(m: MoneyResult, pv: number | null, evSchedule: number | null, method: EacMethod): ForecastResult {
  return forecast({ ev: m.ev, ac: m.ac, bac: m.bac, pv, evSchedule }, method);
}
