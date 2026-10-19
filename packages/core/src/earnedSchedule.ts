import type { ScheduleTask } from './schedule';
import { dayCounter, dayHolidays, dayMode, type DayRule } from './dates';
import { countDays } from './dates';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';

/**
 * Earned schedule (ES): schedule performance measured in TIME rather than in hours.
 *
 *   ES = C + (EV - PV_C) / (PV_C+1 - PV_C)    C = last whole day where cumulative planned value <= EV
 *   SV(t)  = ES - AT                          AT = actual time: days from the first planned start to the status date
 *   SPI(t) = ES / AT
 *
 * Unlike SPI (EV / PV), which drifts to 1.0 as a late project finishes, SPI(t) keeps showing the delay.
 * Days are weekdays or calendar days, matching the choice used for planned value.
 *
 * Our handling where the sources are silent: if all planned work is earned (EV is at or above the
 * planned total), ES is capped at the planned duration; AT keeps counting past the planned end.
 */
const DAY = 86_400_000;
const toUtc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

interface Usable { hours: number; pct: number; start: string; finish: string }

function usable(tasks: ScheduleTask[]): Usable[] {
  const out: Usable[] = [];
  for (const t of tasks) {
    if (t.plannedHours === null || !Number.isFinite(t.plannedHours)) continue;
    if (t.percentComplete === null || !Number.isFinite(t.percentComplete)) continue;
    if (t.plannedStart === null || t.plannedFinish === null || t.plannedFinish < t.plannedStart) continue;
    out.push({ hours: t.plannedHours, pct: t.percentComplete, start: t.plannedStart, finish: t.plannedFinish });
  }
  return out;
}

/** Positions (in the given list) of the tasks that count in schedule measures and the planned value curve. */
export function usableTaskIndexes(tasks: ScheduleTask[]): number[] {
  const out: number[] = [];
  tasks.forEach((t, i) => {
    if (t.plannedHours === null || !Number.isFinite(t.plannedHours)) return;
    if (t.percentComplete === null || !Number.isFinite(t.percentComplete)) return;
    if (t.plannedStart === null || t.plannedFinish === null || t.plannedFinish < t.plannedStart) return;
    out.push(i);
  });
  return out;
}

export interface PvCurve {
  /** Counted days (weekdays or calendar days) from the first planned start to the last planned finish. */
  dates: string[];
  /** Cumulative planned value at the end of each counted day (same length as dates). */
  pv: number[];
}

/** Cumulative planned value by day, for the tasks that can be used in schedule measures. */
export function plannedValueCurve(tasks: ScheduleTask[], mode: DayRule): PvCurve {
  const u = usable(tasks);
  if (u.length === 0) return { dates: [], pv: [] };
  const first = Math.min(...u.map((t) => toUtc(t.start)));
  const last = Math.max(...u.map((t) => toUtc(t.finish)));
  const days = Math.round((last - first) / DAY) + 1;
  const counts = dayCounter(mode);
  const counted: boolean[] = [];
  const cum: number[] = [];
  let c = 0;
  for (let i = 0; i < days; i++) {
    const ok = counts(first + i * DAY);
    counted.push(ok);
    if (ok) c += 1;
    cum.push(c);
  }
  const dates: string[] = [];
  const idxs: number[] = [];
  counted.forEach((ok, i) => { if (ok) { dates.push(toIso(first + i * DAY)); idxs.push(i); } });
  const pv = idxs.map((i) => {
    let sum = 0;
    for (const t of u) {
      const s = Math.round((toUtc(t.start) - first) / DAY);
      const f = Math.round((toUtc(t.finish) - first) / DAY);
      if (i < s) continue;
      if (i >= f) { sum += t.hours; continue; }
      const before = s > 0 ? (cum[s - 1] as number) : 0;
      const total = (cum[f] as number) - before;
      if (total === 0) continue;
      sum += t.hours * (((cum[i] as number) - before) / total);
    }
    return sum;
  });
  return { dates, pv };
}

export interface EarnedScheduleResult {
  status: 'computed' | 'not_available';
  es: number | null;
  at: number | null;
  svT: number | null;
  spiT: number | null;
  plannedDuration: number;
  /** True when all planned work is earned, so ES was capped at the planned duration. */
  capped: boolean;
  projectStart: string | null;
  projectEnd: string | null;
  reasons: string[];
  caveats: string[];
  steps: StepGroup[];
}

const num = (x: number | null, d = 2) => (x === null ? 'not available' : String(roundHalfUp(x, d)));

export function earnedSchedule(tasks: ScheduleTask[], statusDate: string, mode: DayRule): EarnedScheduleResult {
  const u = usable(tasks);
  const none = (reason: string, extra: Partial<EarnedScheduleResult> = {}): EarnedScheduleResult => ({
    status: 'not_available', es: null, at: null, svT: null, spiT: null, plannedDuration: 0, capped: false,
    projectStart: null, projectEnd: null, reasons: [reason], caveats: [], steps: [], ...extra,
  });
  if (u.length === 0) return none('No task has planned hours, progress and usable planned dates.');
  const { dates, pv } = plannedValueCurve(tasks, mode);
  const N = dates.length;
  if (N === 0) return none('The planned dates contain no counted days.');
  const start = dates[0] as string;
  const end = dates[N - 1] as string;
  if (statusDate < start) return none(`The status date (${statusDate}) is before the first planned start (${start}), so no time has passed.`, { projectStart: start, projectEnd: end, plannedDuration: N });
  const at = countDays(start, statusDate, mode);
  const ev = u.reduce((a, t) => a + t.hours * (t.pct / 100), 0);
  const total = pv[N - 1] as number;

  let es: number;
  let capped = false;
  let c = 0;
  let pvC = 0;
  let pvC1 = (pv[0] as number);
  let frac = 0;
  if (ev >= total - 1e-9) {
    es = N;
    capped = true;
  } else {
    // PV_0 = 0; find the last k (1..N) with PV_k <= EV.
    for (let k = 1; k <= N; k++) { if ((pv[k - 1] as number) <= ev) c = k; else break; }
    pvC = c === 0 ? 0 : (pv[c - 1] as number);
    pvC1 = pv[c] as number; // c < N here because EV < total
    frac = (ev - pvC) / (pvC1 - pvC);
    es = c + frac;
  }
  const spiT = at > 0 ? es / at : null;
  const svT = es - at;
  const unit = dayMode(mode) === 'weekdays' ? 'weekdays' : 'calendar days';
  const steps: StepGroup[] = [
    { label: 'Planned duration and actual time', steps: [
      `Planned duration = ${N} ${unit} (${start} to ${end}).`,
      `AT (actual time) = ${unit} from ${start} to ${statusDate}, counting both = ${at}.`,
    ] },
    { label: 'Earned schedule (ES)', steps: capped
      ? ['ES = C + (EV - PV_C) / (PV_C+1 - PV_C)', `All planned work (${num(total)} h) is earned (EV = ${num(ev)} h), so ES = planned duration = ${N} ${unit}.`]
      : [
        'ES = C + (EV - PV_C) / (PV_C+1 - PV_C)',
        `EV = ${num(ev)} h. The planned value curve first goes above this after day ${c}: PV_${c} = ${num(pvC)} h, PV_${c + 1} = ${num(pvC1)} h.`,
        `ES = ${c} + (${num(ev)} - ${num(pvC)}) / (${num(pvC1)} - ${num(pvC)}) = ${num(es, 4)} ${unit}`,
      ] },
    { label: 'Schedule variance in time, SV(t)', steps: ['SV(t) = ES - AT', `SV(t) = ${num(es, 4)} - ${at}`, `SV(t) = ${num(svT)} ${unit} (negative means behind)`] },
    { label: 'Schedule performance in time, SPI(t)', steps: spiT === null ? ['SPI(t) = ES / AT', 'AT is 0, so SPI(t) is not available'] : ['SPI(t) = ES / AT', `SPI(t) = ${num(es, 4)} / ${at}`, `SPI(t) = ${num(spiT, 4)}, shown as ${num(spiT)}`] },
  ];
  const caveats = [
    dayMode(mode) === 'calendar' ? `Time is counted in ${unit}.` : dayHolidays(mode).length > 0 ? `Time is counted in ${unit}, leaving out the ${dayHolidays(mode).length} holiday${dayHolidays(mode).length === 1 ? '' : 's'} you listed.` : `Time is counted in ${unit}. Holidays are not known.`,
    'Only tasks with planned hours, progress and usable planned dates are in the planned value curve.',
  ];
  if (capped) caveats.push('All planned work is earned, so ES is capped at the planned duration (our rule; the published method does not cover this case).');
  if (statusDate > end) caveats.push(`The status date is after the planned end (${end}); actual time keeps counting, so SPI(t) shows the delay.`);
  return { status: 'computed', es, at, svT, spiT, plannedDuration: N, capped, projectStart: start, projectEnd: end, reasons: [], caveats, steps };
}
