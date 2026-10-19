/**
 * Milestones: planned date against what happened. Nothing is forecast here (a milestone's own forecast needs task
 * dependencies, which come later); a milestone is either done (on time or late), past due and still open, due soon,
 * or further away. Days are calendar days. A milestone with no usable planned date is listed, never guessed.
 */
export interface MilestoneInput {
  id: string;
  name: string;
  planned: string | null;
  actual: string | null;
  done: boolean;
  cancelled: boolean;
}
export type MilestoneState = 'done_on_time' | 'done_late' | 'done_no_date' | 'overdue' | 'due_soon' | 'upcoming' | 'no_planned_date';
export interface MilestoneRow {
  id: string;
  name: string;
  planned: string | null;
  actual: string | null;
  state: MilestoneState;
  /** Days late (positive) or early (negative) for finished ones; days past due for overdue; days until due for the rest. */
  days: number | null;
}
export interface MilestoneResult {
  rows: MilestoneRow[];
  counts: Record<MilestoneState, number>;
  cancelled: number;
  /** Planned-to-actual days, averaged over finished milestones that have both dates. */
  averageSlip: number | null;
}

const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const diff = (a: string, b: string) => Math.round((utc(a) - utc(b)) / 86_400_000);

export function analyseMilestones(items: MilestoneInput[], statusDate: string, soonDays = 14): MilestoneResult {
  const counts: Record<MilestoneState, number> = { done_on_time: 0, done_late: 0, done_no_date: 0, overdue: 0, due_soon: 0, upcoming: 0, no_planned_date: 0 };
  const rows: MilestoneRow[] = [];
  const slips: number[] = [];
  let cancelled = 0;
  for (const m of items) {
    if (m.cancelled) { cancelled += 1; continue; }
    let state: MilestoneState;
    let days: number | null = null;
    if (m.planned === null) state = 'no_planned_date';
    else if (m.done) {
      if (m.actual === null) state = 'done_no_date';
      else { days = diff(m.actual, m.planned); slips.push(days); state = days > 0 ? 'done_late' : 'done_on_time'; }
    } else if (m.planned < statusDate) { state = 'overdue'; days = diff(statusDate, m.planned); }
    else { days = diff(m.planned, statusDate); state = days <= soonDays ? 'due_soon' : 'upcoming'; }
    counts[state] += 1;
    rows.push({ id: m.id, name: m.name, planned: m.planned, actual: m.actual, state, days });
  }
  rows.sort((a, b) => (a.planned ?? '9999').localeCompare(b.planned ?? '9999') || a.id.localeCompare(b.id));
  return { rows, counts, cancelled, averageSlip: slips.length === 0 ? null : slips.reduce((a, b) => a + b, 0) / slips.length };
}

export const MILESTONE_LABEL: Record<MilestoneState, string> = {
  done_on_time: 'Done on time', done_late: 'Done late', done_no_date: 'Done (no finish date recorded)', overdue: 'Overdue',
  due_soon: 'Due soon', upcoming: 'Upcoming', no_planned_date: 'No planned date',
};
