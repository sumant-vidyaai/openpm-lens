import type { CsvResult } from './csv';
import type { Unit } from './model';
import type { PercentRule } from './percentComplete';
import type { AnalyseSettings } from './analyse';
import { buildWorkItems, distinctStatuses, mergeMapping, suggestStatusCategory, toHoursTasks, type StatusMap } from './importTasks';
import { detectTableAdapter } from './tableAdapters';
import { analyseRisks, DEFAULT_RISK_BANDS, type RiskInput, type RiskResult, type RiskRow } from './raid';
import { analyseResources, splitPeople, UNASSIGNED, type ResourceResult, type ResourceSettings, type ResourceTask } from './resource';
import { scoreOptions, type Criterion, type OptionResult, type OptionScores } from './initiate';

/**
 * PMO views across several projects (v1.4.1).
 * Rules: every judgement value (weights, scores, capacity, risk limits) is typed by the user.
 * Hours are added first; ratios are worked out from the sums, never averaged.
 */

const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
export const NO_PROJECT_NAMED = '(no project named)';

/* ---------- 1. Priority score ---------- */
export interface PriorityRow extends OptionResult {
  /** False for a name that is only in the score table (not loaded, not in the register). */
  inPortfolio: boolean;
}
export interface PriorityView {
  weightTotal: number;
  criteriaUsed: number;
  ignored: string[];
  rows: PriorityRow[];
  /** Loaded or registered projects with no row in the score table. */
  notScored: string[];
}

/** Weighted score per project = sum(weight x score) / sum(weights), the same rule as option scoring. Highest first; unscored last. */
export function priorityView(portfolioNames: readonly string[], criteria: readonly Criterion[], scores: readonly OptionScores[]): PriorityView {
  const res = scoreOptions(criteria, scores);
  const known = new Set(portfolioNames.map(key));
  const rows: PriorityRow[] = res.options.map((o) => ({ ...o, inPortfolio: known.has(key(o.option)) }));
  rows.sort((a, b) => (a.score === null ? 1 : 0) - (b.score === null ? 1 : 0) || (b.score ?? 0) - (a.score ?? 0) || a.option.localeCompare(b.option));
  const scored = new Set(scores.map((s) => key(s.option)));
  const notScored = [...new Set(portfolioNames)].filter((n) => !scored.has(key(n)));
  return { weightTotal: res.weightTotal, criteriaUsed: res.criteriaUsed, ignored: res.ignored, rows, notScored };
}

/* ---------- 2. Demand against capacity ---------- */
/** One project's tasks in the shape the resource view needs, using the same reading of the file as the project numbers. Null when the file cannot be read yet. */
export function resourceTasksForTable(table: CsvResult, s: AnalyseSettings, assigneeColumn: string | null, project: string): ResourceTask[] | null {
  if (assigneeColumn === null) return null;
  const adapter = detectTableAdapter(table.headers);
  const suggestion = adapter ? adapter.suggest(table.headers) : null;
  const mapping = mergeMapping(table.headers, suggestion?.mapping ?? null);
  if (mapping.name === null) return null;
  const unit: Unit | null = s.unitOverride ?? (suggestion ? suggestion.defaultUnit : 'hours');
  if (unit === null) return null;
  const rule: PercentRule = s.ruleOverride ?? suggestion?.suggestedRule ?? 'tool_reported';
  const statusMap: StatusMap = Object.fromEntries(distinctStatuses(table.headers, table.rows, mapping).map((x) => [x, suggestStatusCategory(x)]));
  const items = buildWorkItems(table.headers, table.rows, mapping, { defaultUnit: unit, percentScale: s.percentScale, statusMap, dateOrder: s.dateOrder });
  const config = rule === 'status_based' ? { inProgressPercent: s.inProgressPercent } : undefined;
  const hours = toHoursTasks(items, { hoursPerDay: s.hoursPerDay, daysPerWeek: 5 }, rule, config);
  const idx = table.headers.indexOf(assigneeColumn);
  if (idx < 0) return null;
  return items.map((it, i) => ({
    id: `${project}: ${it.id}`,
    assignee: (table.rows[i]?.[idx] ?? '').trim() || null,
    plannedHours: hours[i]?.plannedHours ?? null,
    actualHours: hours[i]?.actualHours ?? null,
    plannedStart: it.baselineStart,
    plannedFinish: it.baselineFinish,
  }));
}

export interface PersonProjectHours { person: string; byProject: { project: string; hours: number }[]; total: number }
export interface WeekTotal { weekStart: string; planned: number; capacity: number; utilisation: number | null }
export interface PortfolioCapacity {
  result: ResourceResult;
  /** Planned hours (whole task, not per week) by person and project, for tasks naming one person. */
  split: PersonProjectHours[];
  /** Everyone named, added up per week; utilisation = total planned / total capacity. Unassigned work is not counted. */
  weekTotals: WeekTotal[];
  /** People whose combined weekly load goes over the limit while no single project alone does. */
  overOnlyCombined: string[];
  unassignedHours: number;
  projectsWithoutAssignee: string[];
}

export function portfolioCapacity(sets: { project: string; tasks: ResourceTask[] | null }[], s: ResourceSettings): PortfolioCapacity {
  const usable = sets.filter((x): x is { project: string; tasks: ResourceTask[] } => x.tasks !== null);
  const all = usable.flatMap((x) => x.tasks);
  const result = analyseResources(all, s);
  const acc = new Map<string, { name: string; by: Map<string, number> }>();
  let unassignedHours = 0;
  for (const set of usable) {
    for (const t of set.tasks) {
      const people = splitPeople(t.assignee);
      if (people.length > 1 || t.plannedHours === null || !Number.isFinite(t.plannedHours)) continue;
      if (people.length === 0) { unassignedHours += t.plannedHours; continue; }
      const name = people[0] as string;
      const a = acc.get(key(name)) ?? { name, by: new Map<string, number>() };
      a.by.set(set.project, (a.by.get(set.project) ?? 0) + t.plannedHours);
      acc.set(key(name), a);
    }
  }
  const split: PersonProjectHours[] = [...acc.values()].map((a) => {
    const byProject = [...a.by.entries()].map(([project, hours]) => ({ project, hours })).sort((x, y) => y.hours - x.hours || x.project.localeCompare(y.project));
    return { person: a.name, byProject, total: byProject.reduce((n, b) => n + b.hours, 0) };
  }).sort((a, b) => b.total - a.total || a.person.localeCompare(b.person));
  const named = result.people.filter((p) => p.person !== UNASSIGNED);
  const weekTotals: WeekTotal[] = result.weeks.map((w, i) => {
    const planned = named.reduce((n, p) => n + (p.weeks[i]?.planned ?? 0), 0);
    const capacity = named.reduce((n, p) => n + (p.weeks[i]?.capacity ?? 0), 0);
    return { weekStart: w, planned, capacity, utilisation: capacity > 0 ? (planned / capacity) * 100 : null };
  });
  // Over the limit with all projects together, but not over with any one project alone.
  const overOnlyCombined: string[] = [];
  for (const p of named) {
    if (p.overWeeks === 0) continue;
    const mine = usable.map((x) => analyseResources(x.tasks.filter((t) => splitPeople(t.assignee).length === 1 && key(splitPeople(t.assignee)[0] as string) === key(p.person)), s).people.find((q) => key(q.person) === key(p.person))?.overWeeks ?? 0);
    if (mine.every((n) => n === 0)) overOnlyCombined.push(p.person);
  }
  return {
    result, split, weekTotals, overOnlyCombined, unassignedHours,
    projectsWithoutAssignee: sets.filter((x) => x.tasks === null).map((x) => x.project),
  };
}

/* ---------- 3. Risks across projects ---------- */
export interface ProjectRiskRow { project: string; high: number; medium: number; low: number; unscored: number; overdueActions: number; open: number }
export interface PortfolioRisks {
  overall: RiskResult;
  perProject: ProjectRiskRow[];
  /** Open scored risks, highest score first, with the project named. */
  top: (RiskRow & { project: string })[];
}

export function portfolioRisks(risks: readonly RiskInput[], statusDate: string | null, bands: { mediumMin: number; highMin: number } = DEFAULT_RISK_BANDS): PortfolioRisks {
  const named = risks.map((r) => ({ ...r, project: (r.project ?? '').trim() || NO_PROJECT_NAMED }));
  const overall = analyseRisks(named, statusDate, bands);
  const by = new Map<string, ProjectRiskRow>();
  for (const r of overall.rows) {
    if (r.status !== 'open') continue;
    const p = (r.project ?? NO_PROJECT_NAMED) || NO_PROJECT_NAMED;
    const row = by.get(p) ?? { project: p, high: 0, medium: 0, low: 0, unscored: 0, overdueActions: 0, open: 0 };
    row.open += 1;
    if (r.band === null) row.unscored += 1; else row[r.band] += 1;
    if (r.actionOverdueDays !== null) row.overdueActions += 1;
    by.set(p, row);
  }
  const perProject = [...by.values()].sort((a, b) => b.high - a.high || b.medium - a.medium || b.overdueActions - a.overdueActions || a.project.localeCompare(b.project));
  const top = overall.rows.filter((r): r is RiskRow & { project: string } => r.status === 'open' && r.score !== null);
  return { overall, perProject, top };
}
