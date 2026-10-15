import type { DataIssue } from './model';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';
import { inclusiveDays, MIN_FLOW_SAMPLE, percentileNearestRank } from './flow';

/**
 * Defects (quality). The user chooses which item types count as defects.
 *
 * Sources define "defect age" differently (time from introduction to discovery; time open), and none of
 * these measures has a single standard, so the rules here are THIS APP'S OWN and are stated on screen:
 *  - open as of the status date = not resolved by then (a task marked done with no date counts as closed);
 *  - open age = days from created to the status date, counting both days (same day = 1);
 *  - resolution time = days from created to resolved, counting both days;
 *  - defect share = defects / (defects + other items), cancelled and unknown-type items left out;
 *  - removal efficiency (optional) = defects found before release / all defects with a known "found in" value,
 *    where YOU choose which values mean "after release" (formula as described by common QA references);
 *  - percentages and percentiles need at least MIN_FLOW_SAMPLE items, otherwise "Insufficient data".
 * Defect density needs code size, which project exports rarely have, so it is not offered.
 * Nothing is guessed: cancelled items, unclear dates and defects created after the status date are left out and listed.
 */
export interface DefectItem {
  id: string;
  name: string;
  /** true = counts as a defect, false = other work, null = type unknown. */
  isDefect: boolean | null;
  severity: string | null;
  created: string | null;
  resolved: string | null;
  /** Status says it is done/closed (used when the resolved date is missing). */
  closedByStatus: boolean;
  cancelled: boolean;
  /** true = found after release, false = found before release, null = unknown or not asked. */
  foundAfterRelease: boolean | null;
  issues: DataIssue[];
}

export interface OpenDefect { id: string; name: string; severity: string; created: string | null; age: number | null }
export interface SeverityRow { severity: string; total: number; open: number; closed: number }
export interface DefectResult {
  items: number;
  defects: number;
  open: number;
  closed: number;
  otherItems: number;
  unknownType: number;
  /** Defects / (defects + other items), 0-100; null when fewer than MIN_FLOW_SAMPLE items to compare. */
  sharePercent: number | null;
  openList: OpenDefect[];
  openAgeMean: number | null;
  openAgeMedian: number | null;
  openAgeP85: number | null;
  resolution: { n: number; mean: number; median: number | null; p85: number | null; min: number; max: number } | null;
  bySeverity: SeverityRow[];
  removal: { before: number; after: number; unknown: number; percent: number | null } | null;
  excluded: { id: string; name: string; reason: string }[];
  caveats: string[];
  steps: StepGroup[];
}

export const NO_SEVERITY = '(no severity)';

export function analyseDefects(items: DefectItem[], statusDate: string, usesFoundIn = false): DefectResult {
  const excluded: DefectResult['excluded'] = [];
  const out = (it: DefectItem, reason: string) => excluded.push({ id: it.id, name: it.name, reason });
  let other = 0, unknown = 0;
  const openList: OpenDefect[] = [];
  const res: number[] = [];
  const sev = new Map<string, SeverityRow>();
  let closed = 0, defects = 0, before = 0, after = 0, foundUnknown = 0;
  for (const it of items) {
    if (it.cancelled) { out(it, 'cancelled'); continue; }
    if (it.isDefect === null) { unknown += 1; out(it, 'type is blank, so it is not known whether it is a defect'); continue; }
    if (!it.isDefect) { other += 1; continue; }
    if (it.issues.length > 0) { out(it, `unclear or unreadable date (${it.issues.map((i) => i.field).join(', ')})`); continue; }
    if (it.created !== null && it.created > statusDate) { out(it, 'created after the status date'); continue; }
    const resolvedByDate = it.resolved !== null && it.resolved <= statusDate;
    const isClosed = resolvedByDate || (it.resolved === null && it.closedByStatus);
    defects += 1;
    const key = it.severity ?? NO_SEVERITY;
    const row = sev.get(key) ?? { severity: key, total: 0, open: 0, closed: 0 };
    row.total += 1;
    if (isClosed) {
      closed += 1; row.closed += 1;
      if (resolvedByDate && it.created !== null && (it.resolved as string) >= it.created) res.push(inclusiveDays(it.created, it.resolved as string));
    } else {
      row.open += 1;
      openList.push({ id: it.id, name: it.name, severity: key, created: it.created, age: it.created === null ? null : inclusiveDays(it.created, statusDate) });
    }
    sev.set(key, row);
    if (usesFoundIn) {
      if (it.foundAfterRelease === null) foundUnknown += 1;
      else if (it.foundAfterRelease) after += 1; else before += 1;
    }
  }
  openList.sort((a, b) => (b.age ?? -1) - (a.age ?? -1) || a.id.localeCompare(b.id));
  const ages = openList.map((o) => o.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
  const ageReliable = ages.length >= MIN_FLOW_SAMPLE;
  const sortedRes = [...res].sort((a, b) => a - b);
  const resReliable = sortedRes.length >= MIN_FLOW_SAMPLE;
  const comparable = defects + other;
  const knownFound = before + after;
  const caveats: string[] = [];
  if (excluded.length > 0) caveats.push(`${excluded.length} of ${items.length} items left out (see the list).`);
  const noCreated = openList.filter((o) => o.age === null).length;
  if (noCreated > 0) caveats.push(`${noCreated} open defect${noCreated === 1 ? ' has' : 's have'} no created date: counted as open, left out of age.`);
  if (comparable > 0 && comparable < MIN_FLOW_SAMPLE) caveats.push(`Only ${comparable} item${comparable === 1 ? '' : 's'} to compare: the defect share needs at least ${MIN_FLOW_SAMPLE} (Insufficient data).`);
  if (ages.length > 0 && !ageReliable) caveats.push(`Only ${ages.length} open defect${ages.length === 1 ? '' : 's'} with a created date: age percentiles need at least ${MIN_FLOW_SAMPLE}.`);
  if (res.length > 0 && !resReliable) caveats.push(`Only ${res.length} resolved defect${res.length === 1 ? '' : 's'} with both dates: resolution percentiles need at least ${MIN_FLOW_SAMPLE}.`);
  if (usesFoundIn && foundUnknown > 0) caveats.push(`${foundUnknown} defect${foundUnknown === 1 ? ' has' : 's have'} no "found in" value and ${foundUnknown === 1 ? 'is' : 'are'} left out of removal efficiency.`);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const n = (x: number | null, d = 1) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const sharePercent = comparable >= MIN_FLOW_SAMPLE ? roundHalfUp((defects / comparable) * 100, 0) : null;
  const removalPercent = knownFound >= MIN_FLOW_SAMPLE ? roundHalfUp((before / knownFound) * 100, 0) : null;
  const steps: StepGroup[] = [
    { label: 'Which items are defects', steps: [`Defects = items whose type you marked as a defect. Defects counted: ${defects}; other items: ${other}.`, `Open at ${statusDate} = not resolved by then: ${openList.length}; closed: ${closed}.`] },
    { label: 'Defect share', steps: ['Share = defects / (defects + other items)', comparable >= MIN_FLOW_SAMPLE ? `Share = ${defects} / ${comparable} = ${n((defects / comparable) * 100, 0)}%` : `Fewer than ${MIN_FLOW_SAMPLE} items: not shown (Insufficient data)`] },
    { label: 'Open defect age', steps: ['Age = days from created to the status date, counting both days', ages.length === 0 ? 'No open defect with a created date.' : `Ages: ${ages.join(', ')}; mean ${n(mean(ages))} days`] },
    { label: 'Resolution time', steps: ['Resolution time = days from created to resolved, counting both days', sortedRes.length === 0 ? 'No resolved defect with both dates.' : `Sorted: ${sortedRes.join(', ')}; mean ${n(mean(sortedRes))} days`, resReliable ? `Percentiles (nearest rank): 50th = ${percentileNearestRank(sortedRes, 50)}, 85th = ${percentileNearestRank(sortedRes, 85)}` : `Percentiles need at least ${MIN_FLOW_SAMPLE} resolved defects (Insufficient data)`] },
  ];
  if (usesFoundIn) steps.push({ label: 'Defect removal efficiency', steps: ['Efficiency = defects found before release / all defects with a known "found in" value x 100', knownFound >= MIN_FLOW_SAMPLE ? `Efficiency = ${before} / ${knownFound} = ${n((before / knownFound) * 100, 0)}%` : `Fewer than ${MIN_FLOW_SAMPLE} defects with a known value: not shown (Insufficient data)`] });
  return {
    items: items.length, defects, open: openList.length, closed, otherItems: other, unknownType: unknown, sharePercent,
    openList, openAgeMean: ages.length === 0 ? null : mean(ages), openAgeMedian: ageReliable ? percentileNearestRank(ages, 50) : null,
    openAgeP85: ageReliable ? percentileNearestRank(ages, 85) : null,
    resolution: sortedRes.length === 0 ? null : { n: sortedRes.length, mean: mean(sortedRes), median: resReliable ? percentileNearestRank(sortedRes, 50) : null, p85: resReliable ? percentileNearestRank(sortedRes, 85) : null, min: sortedRes[0] as number, max: sortedRes[sortedRes.length - 1] as number },
    bySeverity: [...sev.values()].sort((a, b) => b.total - a.total || a.severity.localeCompare(b.severity)),
    removal: usesFoundIn ? { before, after, unknown: foundUnknown, percent: removalPercent } : null,
    excluded, caveats, steps,
  };
}
