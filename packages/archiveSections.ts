import type { ArchiveInput } from '@spashta/core';
import type { LifecycleSheets } from '@spashta/core';
import type { SharedData } from './shared';

type Source = { raid: Pick<LifecycleSheets, 'risks' | 'issues' | 'changes'> | null; initiate: Pick<LifecycleSheets, 'scoring' | 'businessCase' | 'stakeholders' | 'solicitations' | 'goRecord'> | null; close: Pick<LifecycleSheets, 'benefits' | 'checklist' | 'lessons'> | null };

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const v = <T,>(x: T | null | undefined): T | '' => (x === null || x === undefined ? '' : x);

/** Turns every filled optional sheet of the loaded file back into rows, in the same column order as the template. Absent sheets are skipped. */
export function archiveSections(s: Source | SharedData): ArchiveInput['sections'] {
  const out: ArchiveInput['sections'] = [];
  const r = s.raid, i = s.initiate, c = s.close;
  if (r?.risks.present) out.push({ file: 'risks.csv', title: 'Risks', rows: [['ID', 'Risk', 'Probability (1-5)', 'Impact (1-5)', 'Owner', 'Response', 'Status', 'Action', 'Action due', 'Action done'], ...r.risks.risks.map((x) => [x.id, x.title, v(x.probability), v(x.impact), x.owner, x.response, cap(x.status), x.action, v(x.actionDue), v(x.actionDone)])] });
  if (r?.issues.present) out.push({ file: 'issues.csv', title: 'Issues', rows: [['ID', 'Issue', 'Priority', 'Owner', 'Status', 'Raised', 'Due', 'Resolved'], ...r.issues.issues.map((x) => [x.id, x.title, v(x.priority), x.owner, cap(x.status), v(x.raised), v(x.due), v(x.resolved)])] });
  if (r?.changes.present) out.push({ file: 'changes.csv', title: 'Changes', rows: [['ID', 'Change', 'Requested by', 'Decision', 'Requested', 'Decided', 'Cost impact (h)', 'Schedule impact (days)'], ...r.changes.changes.map((x) => [x.id, x.title, x.requestedBy, cap(x.decision), v(x.requested), v(x.decided), v(x.costHours), v(x.scheduleDays)])] });
  if (i?.scoring.present) {
    const crit = i.scoring.criteria;
    out.push({ file: 'scoring.csv', title: 'Scoring', rows: [['Option', ...crit.map((k) => k.name)], ['Weight', ...crit.map((k) => v(k.weight))], ...i.scoring.options.map((o) => [o.option, ...crit.map((k) => v(o.scores[k.name]))])] });
  }
  if (i?.businessCase.present) out.push({ file: 'business-case.csv', title: 'Business case', rows: [['Period', 'Cost', 'Benefit'], ...i.businessCase.years.map((y) => [y.period, v(y.cost), v(y.benefit)])] });
  if (i?.stakeholders.present) out.push({ file: 'stakeholders.csv', title: 'Stakeholders', rows: [['Name', 'Role', 'Power (1-5)', 'Interest (1-5)', 'Note'], ...i.stakeholders.stakeholders.map((x) => [x.name, x.role, v(x.power), v(x.interest), x.note])] });
  if (i?.solicitations.present) out.push({ file: 'rfi-rfp.csv', title: 'RFI and RFP', rows: [['ID', 'Type', 'Vendor', 'Due', 'Received', 'Status'], ...i.solicitations.rows.map((x) => [x.id, x.kind, x.vendor, v(x.due), v(x.received), v(x.status)])] });
  if (i?.goRecord.present && i.goRecord.record) { const g = i.goRecord.record; out.push({ file: 'go-no-go.csv', title: 'Go / no-go decision', rows: [['Decision', 'Decided by', 'Date', 'Reason'], [g.decision === 'go' ? 'Go' : g.decision === 'no_go' ? 'No go' : g.decision === 'hold' ? 'Hold' : '', v(g.decidedBy), v(g.date), v(g.reason)]] }); }
  if (c?.checklist.present) out.push({ file: 'checklist.csv', title: 'Closure checklist', rows: [['Group', 'Item', 'Owner', 'Status', 'Done on'], ...c.checklist.items.map((x) => [x.group, x.item, x.owner, x.status === 'done' ? 'Done' : x.status === 'open' ? 'Open' : x.status === 'na' ? 'Not applicable' : '', v(x.doneOn)])] });
  if (c?.lessons.present) out.push({ file: 'lessons.csv', title: 'Lessons learned', rows: [['Category', 'Lesson', 'Recommendation', 'Owner', 'Raised'], ...c.lessons.lessons.map((x) => [x.category, x.lesson, x.recommendation, x.owner, v(x.raised)])] });
  if (c?.benefits.present) out.push({ file: 'benefits.csv', title: 'Benefits', rows: [['ID', 'Benefit', 'Owner', 'Measure', 'Planned', 'Realised', 'Due'], ...c.benefits.benefits.map((x) => [x.id, x.name, x.owner, x.measure, v(x.planned), v(x.realised), v(x.due)])] });
  return out;
}
