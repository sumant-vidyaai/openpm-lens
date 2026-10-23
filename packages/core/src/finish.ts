/**
 * Finish-date forecast by simulation ("Monte Carlo"): draw past weekly throughputs at random, with replacement, take them off the
 * remaining items until none are left, count the weeks, and repeat many times. The spread of the counts gives the dates that 50%,
 * 85% and 95% of the simulated futures finish by. Assumes the past weekly pace is a fair guide to the future and that items are of
 * comparable size. Scope changes need a new run. The random numbers are seeded, so the same inputs always give the same answer.
 */
export const FORECAST_DEFAULTS = { trials: 10_000, historyWeeks: 12, minWeeks: 4, warnBelowWeeks: 6, warnAboveWeeks: 26, seed: 1 } as const;
const MAX_WEEKS = 520;

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
export const dayDiff = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);
export const addDaysIso = (iso: string, n: number) => new Date(utc(iso) + n * 86_400_000).toISOString().slice(0, 10);

export interface WeeklyHistory {
  /** Items finished in each full week, oldest first. Weeks with nothing finished are kept as 0 (a quiet week is real information). */
  weekly: number[];
  /** First day of the oldest week and the last day (the status date). */
  windowStart: string | null;
  windowEnd: string;
  finishedInWindow: number;
  /** Finished before the window / dated after the status date: left out, reported. */
  finishedBefore: number;
  finishedAfter: number;
}

/**
 * Weekly throughput counted back from the status date in whole weeks (week 1 = the 7 days ending on the status date).
 * The window never reaches before `projectStart` (or, if not known, the first finish), so weeks before the work began are not counted as quiet weeks.
 */
export function weeklyThroughput(finishDates: string[], statusDate: string, weeksWanted: number, projectStart: string | null): WeeklyHistory {
  const dates = finishDates.filter((d) => d <= statusDate).sort();
  const start = projectStart !== null && projectStart <= statusDate ? projectStart : dates[0] ?? null;
  const base = { windowEnd: statusDate, finishedAfter: finishDates.length - dates.length };
  if (start === null || weeksWanted < 1) return { ...base, weekly: [], windowStart: null, finishedInWindow: 0, finishedBefore: dates.length };
  const available = Math.floor((dayDiff(start, statusDate) + 1) / 7);
  const weeks = Math.max(0, Math.min(Math.floor(weeksWanted), available));
  const weekly = new Array<number>(weeks).fill(0);
  let inWin = 0;
  for (const d of dates) {
    const back = dayDiff(d, statusDate); // 0 = status date
    const k = Math.floor(back / 7);
    if (k < weeks) { weekly[weeks - 1 - k] = (weekly[weeks - 1 - k] ?? 0) + 1; inWin += 1; }
  }
  return { ...base, weekly, windowStart: weeks > 0 ? addDaysIso(statusDate, -(weeks * 7 - 1)) : null, finishedInWindow: inWin, finishedBefore: dates.length - inWin };
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ForecastDist {
  trials: number;
  remaining: number;
  /** cum[w] = number of trials that finished within w weeks (w = 0..MAX_WEEKS). */
  cum: number[];
  /** Trials that had not finished within MAX_WEEKS (counted as never). */
  capped: number;
  seed: number;
}

/** Runs the simulation. Null when nothing can be said: no history, or every week in it was zero while work remains. */
export function simulateFinish(weekly: number[], remaining: number, trials: number = FORECAST_DEFAULTS.trials, seed: number = FORECAST_DEFAULTS.seed): ForecastDist | null {
  if (remaining < 0 || !Number.isFinite(remaining)) return null;
  const counts = new Array<number>(MAX_WEEKS + 1).fill(0);
  let capped = 0;
  if (remaining === 0) counts[0] = trials;
  else {
    if (weekly.length === 0 || weekly.every((w) => w <= 0)) return null;
    const rnd = mulberry32(seed);
    const n = weekly.length;
    for (let t = 0; t < trials; t++) {
      let left = remaining, w = 0;
      while (left > 0 && w < MAX_WEEKS) { left -= weekly[Math.floor(rnd() * n)] as number; w += 1; }
      if (left > 0) capped += 1; else counts[w] = (counts[w] ?? 0) + 1;
    }
  }
  const cum: number[] = [];
  let run = 0;
  for (const c of counts) { run += c; cum.push(run); }
  return { trials, remaining, cum, capped, seed };
}

/** Fewest weeks within which at least `p` (0 to 1) of the trials finished; null if that share never finished. */
export function weeksAtConfidence(d: ForecastDist, p: number): number | null {
  const need = p * d.trials;
  const w = d.cum.findIndex((c) => c >= need);
  return w < 0 ? null : w;
}
/** Share (0 to 1) of trials that finished within `weeks` whole weeks. */
export function chanceWithin(d: ForecastDist, weeks: number): number {
  if (weeks < 0) return 0;
  return (d.cum[Math.min(Math.floor(weeks), MAX_WEEKS)] ?? 0) / d.trials;
}
/** Chance of finishing by a calendar date, counting whole weeks from the status date (a week's work is taken as done at the end of that week). */
export function chanceByDate(d: ForecastDist, statusDate: string, byDate: string): number {
  return chanceWithin(d, Math.floor(dayDiff(statusDate, byDate) / 7));
}

export interface ForecastSummary {
  weeks50: number | null; weeks85: number | null; weeks95: number | null;
  date50: string | null; date85: string | null; date95: string | null;
}
export function summarise(d: ForecastDist, statusDate: string): ForecastSummary {
  const f = (p: number) => { const w = weeksAtConfidence(d, p); return { w, date: w === null ? null : addDaysIso(statusDate, 7 * w) }; };
  const a = f(0.5), b = f(0.85), c = f(0.95);
  return { weeks50: a.w, weeks85: b.w, weeks95: c.w, date50: a.date, date85: b.date, date95: c.date };
}

export type HistoryVerdict = 'ok' | 'warn_short' | 'warn_long' | 'too_short' | 'none';
/** Starting rules from published guidance (not a standard): fewer than 4 full weeks is refused, fewer than 6 is jittery, more than 26 may reflect an old pace. */
export function historyVerdict(h: WeeklyHistory): HistoryVerdict {
  const n = h.weekly.length;
  if (h.finishedInWindow === 0) return 'none';
  if (n < FORECAST_DEFAULTS.minWeeks) return 'too_short';
  if (n < FORECAST_DEFAULTS.warnBelowWeeks) return 'warn_short';
  if (n > FORECAST_DEFAULTS.warnAboveWeeks) return 'warn_long';
  return 'ok';
}

// ---------------------------------------------------------------- milestones
export interface GateItem { id: string; name: string; plannedFinish: string | null; done: boolean; cancelled: boolean; excluded: boolean }
export interface MilestoneForecastInput { id: string; name: string; planned: string | null }
export interface MilestoneForecast {
  id: string; name: string; planned: string | null;
  /** Open items planned to finish on or before the milestone's planned date: taken as the work the milestone needs. */
  gating: number;
  summary: ForecastSummary | null;
  /** Chance of finishing that work by the planned date (null with no planned date or no forecast). */
  chance: number | null;
}

/**
 * Forecast for each milestone. Without task dependencies the work a milestone needs is not known, so the open items planned to
 * finish on or before its planned date are treated as that work. This is an assumption and is shown on screen.
 */
export function forecastMilestones(ms: MilestoneForecastInput[], items: GateItem[], weekly: number[], statusDate: string, trials: number = FORECAST_DEFAULTS.trials, seed: number = FORECAST_DEFAULTS.seed): MilestoneForecast[] {
  const cache = new Map<number, ForecastDist | null>();
  const dist = (n: number) => { if (!cache.has(n)) cache.set(n, simulateFinish(weekly, n, trials, seed)); return cache.get(n) ?? null; };
  return ms.map((m) => {
    if (m.planned === null) return { id: m.id, name: m.name, planned: null, gating: 0, summary: null, chance: null };
    const gating = items.filter((i) => !i.excluded && !i.cancelled && !i.done && i.plannedFinish !== null && i.plannedFinish <= (m.planned as string)).length;
    const d = dist(gating);
    return { id: m.id, name: m.name, planned: m.planned, gating, summary: d ? summarise(d, statusDate) : null, chance: d ? chanceByDate(d, statusDate, m.planned) : null };
  });
}
