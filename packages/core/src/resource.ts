import type { DayCount } from './dates';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';

/**
 * Workload per person per week, against a weekly capacity that YOU enter.
 *
 * Planned hours of each task are spread evenly over its planned working days (weekdays, or every
 * calendar day if you choose) and added up per person per week (weeks start on Monday). Utilisation =
 * planned hours in the week / capacity. A week is flagged when utilisation is above the limit you set
 * (default 100%). These are plain arithmetic rules of this app, not a standard.
 *
 * Nothing is guessed: a task naming several people (separated by ";") is left out because the split is
 * unknown; a task with nobody assigned goes to an "(unassigned)" row; tasks without planned hours or
 * usable dates are left out of the weekly load and listed.
 */
export const UNASSIGNED = '(unassigned)';

/** Names in a cell, split on ";" only (a comma is often part of one name, as in "Smith, Ann"). */
export function splitPeople(text: string | null): string[] {
  if (text === null) return [];
  return text.split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s !== '');
}

export interface ResourceTask {
  id: string;
  assignee: string | null;
  plannedHours: number | null;
  actualHours: number | null;
  plannedStart: string | null;
  plannedFinish: string | null;
}

export interface ResourceSettings {
  /** Hours one person can work in a week. */
  capacityDefault: number;
  /** Own weekly capacity by person (name ignoring case and spacing). */
  capacityByPerson: Record<string, number>;
  mode: DayCount;
  /** Flag a week above this percent (default 100). */
  overPercent: number;
}

export interface PersonWeek { weekStart: string; planned: number; utilisation: number | null }
export interface PersonRow {
  person: string;
  capacity: number;
  tasks: number;
  plannedTotal: number;
  /** Planned and actual hours over the tasks that have both. */
  plannedForActual: number;
  actualTotal: number;
  actualVsPlanned: number | null;
  weeks: PersonWeek[];
  overWeeks: number;
  peak: number | null;
}

export interface ResourceResult {
  weeks: string[];
  people: PersonRow[];
  excluded: { id: string; reason: string }[];
  caveats: string[];
  steps: StepGroup[];
}

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
/** Monday of the week containing the date. */
export function weekStart(date: string): string {
  const t = utc(date);
  const wd = new Date(t).getUTCDay(); // 0 = Sunday
  return iso(t - ((wd + 6) % 7) * DAY);
}

export const MAX_WEEKS = 104;

export function analyseResources(tasks: ResourceTask[], s: ResourceSettings): ResourceResult {
  const cap = new Map(Object.entries(s.capacityByPerson).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => [key(k), v]));
  const excluded: { id: string; reason: string }[] = [];
  interface Acc { name: string; tasks: number; planned: number; plannedBoth: number; actual: number; load: Map<string, number> }
  const accs = new Map<string, Acc>();
  const get = (name: string): Acc => {
    const k = key(name);
    let a = accs.get(k);
    if (!a) { a = { name, tasks: 0, planned: 0, plannedBoth: 0, actual: 0, load: new Map() }; accs.set(k, a); }
    return a;
  };
  let first: string | null = null, last: string | null = null;
  for (const t of tasks) {
    const people = splitPeople(t.assignee);
    if (people.length > 1) { excluded.push({ id: t.id, reason: `several people named (${people.join('; ')}): the split of hours is not known` }); continue; }
    const a = get(people[0] ?? UNASSIGNED);
    a.tasks += 1;
    if (t.plannedHours === null || !Number.isFinite(t.plannedHours)) { excluded.push({ id: t.id, reason: 'no planned hours' }); continue; }
    a.planned += t.plannedHours;
    if (t.actualHours !== null && Number.isFinite(t.actualHours)) { a.plannedBoth += t.plannedHours; a.actual += t.actualHours; }
    if (t.plannedStart === null || t.plannedFinish === null || t.plannedFinish < t.plannedStart) { excluded.push({ id: t.id, reason: 'no usable planned dates: left out of the weekly load' }); continue; }
    // counted days
    const days: string[] = [];
    for (let d = utc(t.plannedStart); d <= utc(t.plannedFinish); d += DAY) {
      const wd = new Date(d).getUTCDay();
      if (s.mode === 'calendar' || (wd !== 0 && wd !== 6)) days.push(iso(d));
    }
    const spread = days.length === 0 ? [t.plannedFinish] : days; // a span with no counted days is due on its finish date
    const per = t.plannedHours / spread.length;
    for (const d of spread) { const w = weekStart(d); a.load.set(w, (a.load.get(w) ?? 0) + per); }
    if (first === null || t.plannedStart < first) first = t.plannedStart;
    if (last === null || t.plannedFinish > last) last = t.plannedFinish;
  }
  const weeks: string[] = [];
  const caveats: string[] = [];
  if (first !== null && last !== null) {
    for (let w = utc(weekStart(first)); w <= utc(last); w += 7 * DAY) weeks.push(iso(w));
    if (weeks.length > MAX_WEEKS) { weeks.length = MAX_WEEKS; caveats.push(`Only the first ${MAX_WEEKS} weeks are shown.`); }
  }
  const people: PersonRow[] = [...accs.values()].sort((a, b) => (a.name === UNASSIGNED ? 1 : b.name === UNASSIGNED ? -1 : a.name.localeCompare(b.name))).map((a) => {
    const capacity = cap.get(key(a.name)) ?? s.capacityDefault;
    const wk: PersonWeek[] = weeks.map((w) => {
      const planned = a.load.get(w) ?? 0;
      return { weekStart: w, planned, utilisation: capacity > 0 ? (planned / capacity) * 100 : null };
    });
    const util = wk.map((x) => x.utilisation).filter((x): x is number => x !== null);
    return {
      person: a.name, capacity, tasks: a.tasks, plannedTotal: a.planned, plannedForActual: a.plannedBoth, actualTotal: a.actual,
      actualVsPlanned: a.plannedBoth > 0 ? a.actual / a.plannedBoth : null, weeks: wk,
      overWeeks: util.filter((u) => u > s.overPercent + 1e-9).length, peak: util.length === 0 ? null : Math.max(...util),
    };
  });
  if (people.some((p) => p.person === UNASSIGNED)) caveats.push('Some tasks have nobody assigned; their load is shown on the "(unassigned)" row and not given to anyone.');
  if (excluded.length > 0) caveats.push(`${excluded.length} task${excluded.length === 1 ? '' : 's'} left out of some or all figures (see the list).`);
  caveats.push(`Weekly load spreads each task's planned hours evenly over its ${s.mode === 'weekdays' ? 'weekdays (holidays and leave not known)' : 'calendar days'}. Weeks start on Monday.`);
  const n = (x: number | null, d = 0) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const worst = [...people].filter((p) => p.peak !== null).sort((a, b) => (b.peak as number) - (a.peak as number))[0];
  const steps: StepGroup[] = [
    { label: 'Weekly load', steps: ['Each task: planned hours / number of counted days in its planned dates = hours per day', 'Load in a week = sum of those daily hours that fall in the week (Monday to Sunday), per person'] },
    { label: 'Utilisation', steps: ['Utilisation = load in the week / weekly capacity', `Capacity: ${s.capacityDefault} hours a week unless set for a person; a week is flagged above ${s.overPercent}%`, worst ? `Highest week: ${worst.person}, ${n(worst.peak)}% of ${worst.capacity} hours` : 'No weekly load could be worked out'] },
    { label: 'Planned vs actual per person', steps: ['Actual / planned = actual hours / planned hours, over the tasks that have both'] },
  ];
  return { weeks, people, excluded, caveats, steps };
}
