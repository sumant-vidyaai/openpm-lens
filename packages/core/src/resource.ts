import { dayCounter, dayHolidays, dayMode, type DayRule } from './dates';
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
  mode: DayRule;
  /** Flag a week above this percent (default 100). */
  overPercent: number;
  /** Days a person is away (inclusive ISO dates). Each Monday-to-Friday day away takes 1/5 off that person's capacity for the week. */
  leave?: LeaveEntry[];
}

export interface LeaveEntry { person: string; from: string; to: string }

export interface PersonWeek { weekStart: string; planned: number; utilisation: number | null; /** Capacity that week after holidays and leave. */ capacity: number }
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
  const counted = dayCounter(s.mode);
  const holidays = new Set(dayHolidays(s.mode));
  const leaveBy = new Map<string, LeaveEntry[]>();
  for (const l of s.leave ?? []) { const k = key(l.person); leaveBy.set(k, [...(leaveBy.get(k) ?? []), l]); }
  /** Monday-to-Friday days of the week that are not holidays and not on this person's leave. */
  const availableDays = (person: string, week: string): number => {
    const mine = leaveBy.get(key(person)) ?? [];
    let n = 0;
    for (let i = 0; i < 5; i++) {
      const d = iso(utc(week) + i * DAY);
      if (holidays.has(d)) continue;
      if (mine.some((l) => d >= l.from && d <= l.to)) continue;
      n += 1;
    }
    return n;
  };
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
      if (counted(d)) days.push(iso(d));
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
      const cw = capacity * (availableDays(a.name, w) / 5);
      return { weekStart: w, planned, capacity: cw, utilisation: cw > 0 ? (planned / cw) * 100 : null };
    });
    // Work planned in a week with no capacity at all (all five days away or holidays) counts as over the limit.
    const noRoom = wk.filter((x) => x.capacity === 0 && x.planned > 1e-9).length;
    const util = wk.map((x) => x.utilisation).filter((x): x is number => x !== null);
    return {
      person: a.name, capacity, tasks: a.tasks, plannedTotal: a.planned, plannedForActual: a.plannedBoth, actualTotal: a.actual,
      actualVsPlanned: a.plannedBoth > 0 ? a.actual / a.plannedBoth : null, weeks: wk,
      overWeeks: util.filter((u) => u > s.overPercent + 1e-9).length + noRoom, peak: util.length === 0 ? null : Math.max(...util),
    };
  });
  if (people.some((p) => p.person === UNASSIGNED)) caveats.push('Some tasks have nobody assigned; their load is shown on the "(unassigned)" row and not given to anyone.');
  if (excluded.length > 0) caveats.push(`${excluded.length} task${excluded.length === 1 ? '' : 's'} left out of some or all figures (see the list).`);
  const nHol = holidays.size, nLeave = (s.leave ?? []).length;
  caveats.push(`Weekly load spreads each task's planned hours evenly over its ${dayMode(s.mode) === 'weekdays' ? (nHol > 0 ? `weekdays, leaving out the ${nHol} holiday${nHol === 1 ? '' : 's'} you listed` : 'weekdays (holidays not known)') : 'calendar days'}. Weeks start on Monday.`);
  caveats.push(nLeave > 0 ? `Leave: ${nLeave} leave entr${nLeave === 1 ? 'y' : 'ies'} used. Each Monday-to-Friday day away (or holiday) takes one fifth off that person's weekly capacity.` : 'Leave: none listed, so everyone is assumed available every working day.');
  const n = (x: number | null, d = 0) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const worst = [...people].filter((p) => p.peak !== null).sort((a, b) => (b.peak as number) - (a.peak as number))[0];
  const steps: StepGroup[] = [
    { label: 'Weekly load', steps: ['Each task: planned hours / number of counted days in its planned dates = hours per day', 'Load in a week = sum of those daily hours that fall in the week (Monday to Sunday), per person'] },
    { label: 'Utilisation', steps: ['Utilisation = load in the week / weekly capacity (capacity is reduced by one fifth for each holiday or day of leave that week)', `Capacity: ${s.capacityDefault} hours a week unless set for a person; a week is flagged above ${s.overPercent}%`, worst ? `Highest week: ${worst.person}, ${n(worst.peak)}% of ${worst.capacity} hours` : 'No weekly load could be worked out'] },
    { label: 'Planned vs actual per person', steps: ['Actual / planned = actual hours / planned hours, over the tasks that have both'] },
  ];
  return { weeks, people, excluded, caveats, steps };
}
