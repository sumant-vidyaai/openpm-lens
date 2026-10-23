import { HEALTH_LABEL, type Health } from './health';
import { roundHalfUp } from './format';

/** The facts a status report is written from. Every field may be missing; a missing fact is left out, never guessed. */
export interface ReportFacts {
  statusDate: string;
  health: Health;
  cpi: number | null; spi: number | null;
  counts: { total: number; done: number; inProgress: number; notStarted: number; cancelled: number } | null;
  openDefects: number | null;
  milestones: { overdue: number; dueSoon: number; open: number } | null;
  forecast: { open: number; date50: string | null; date85: string | null; date95: string | null; plannedFinish: string | null; chancePlanned: number | null; verdictNote: string } | null;
  raid: { highRisks: number; openRisks: number; overdueActions: number; openIssues: number; overdueIssues: number; oldestIssueDays: number | null; approvedHours: number; approvedDays: number; scopeGrowthPercent: number | null; waitingRequests: number } | null;
  /** Largest known drags on cost and schedule: names with their share, in words already worked out elsewhere. */
  drags: string[];
}

export interface Commentary { headline: string; highlights: string[]; concerns: string[]; limits: string[] }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const idx = (x: number) => String(roundHalfUp(x, 2));

/** Plain sentences stating only what the numbers show. They say what is, not why: the reason is for the project manager to add. */
export function writeCommentary(f: ReportFacts): Commentary {
  const highlights: string[] = [], concerns: string[] = [], limits: string[] = [];
  const headline = `As of ${f.statusDate} the project is ${HEALTH_LABEL[f.health].toLowerCase()}.`;

  if (f.cpi !== null) (f.cpi >= 1 ? highlights : concerns).push(`Cost index (CPI) is ${idx(f.cpi)}: ${f.cpi >= 1 ? 'the work done is worth at least what was spent' : `each hour spent has so far earned ${idx(f.cpi)} hours of planned work`}.`);
  if (f.spi !== null) (f.spi >= 1 ? highlights : concerns).push(`Schedule index (SPI) is ${idx(f.spi)}: ${f.spi >= 1 ? 'the work done is at or ahead of the plan' : `${roundHalfUp((1 - f.spi) * 100, 0)}% less planned work is done than the plan called for by this date`}.`);
  if (f.health === 'insufficient') limits.push('Too little data to rate overall health.');

  if (f.counts) {
    const c = f.counts;
    highlights.push(`${c.done} of ${c.total - c.cancelled} active items are done; ${c.inProgress} in progress, ${c.notStarted} not started${c.cancelled > 0 ? ` (${c.cancelled} cancelled, left out)` : ''}.`);
  }
  if (f.openDefects !== null && f.openDefects > 0) concerns.push(`${plural(f.openDefects, 'defect')} still open.`);

  if (f.milestones && f.milestones.open + f.milestones.overdue > 0) {
    if (f.milestones.overdue > 0) concerns.push(`${plural(f.milestones.overdue, 'milestone')} past the planned date and not finished.`);
    if (f.milestones.dueSoon > 0) concerns.push(`${plural(f.milestones.dueSoon, 'milestone')} due within 14 days.`);
  }

  if (f.forecast && f.forecast.open > 0) {
    if (f.forecast.date85) {
      let s = `At the recent weekly pace, the ${plural(f.forecast.open, 'open item')} are 85% likely to be finished by ${f.forecast.date85} (50%: ${f.forecast.date50 ?? 'n/a'}, 95%: ${f.forecast.date95 ?? 'n/a'}).`;
      if (f.forecast.plannedFinish && f.forecast.chancePlanned !== null) s += ` The chance of meeting the latest planned finish (${f.forecast.plannedFinish}) is about ${roundHalfUp(f.forecast.chancePlanned * 100, 0)}%.`;
      (f.forecast.chancePlanned !== null && f.forecast.chancePlanned < 0.5 ? concerns : highlights).push(s);
    }
    if (f.forecast.verdictNote) limits.push(f.forecast.verdictNote);
  }

  if (f.raid) {
    const r = f.raid;
    if (r.highRisks > 0) concerns.push(`${plural(r.highRisks, 'open risk')} rated high (of ${r.openRisks} open).`);
    if (r.overdueActions > 0) concerns.push(`${plural(r.overdueActions, 'risk response action')} overdue.`);
    if (r.openIssues > 0) concerns.push(`${plural(r.openIssues, 'open issue')}${r.overdueIssues > 0 ? `, ${r.overdueIssues} overdue` : ''}${r.oldestIssueDays !== null ? `; the oldest has been open ${plural(r.oldestIssueDays, 'day')}` : ''}.`);
    if (r.approvedHours !== 0 || r.approvedDays !== 0) concerns.push(`Approved changes have added ${roundHalfUp(r.approvedHours, 1)} hours and ${roundHalfUp(r.approvedDays, 1)} days${r.scopeGrowthPercent !== null ? ` (${roundHalfUp(r.scopeGrowthPercent, 1)}% of the original budget)` : ''}.`);
    if (r.waitingRequests > 0) concerns.push(`${plural(r.waitingRequests, 'change request')} waiting for a decision.`);
  }
  for (const d of f.drags) concerns.push(d);
  if (highlights.length === 0) limits.push('No positive finding could be stated from the data given.');
  limits.push('These sentences state what the numbers show, not why. Add the reasons and the decisions needed.');
  return { headline, highlights, concerns, limits };
}
