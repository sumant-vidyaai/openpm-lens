import { XMLParser } from 'fast-xml-parser';
import type { CsvResult } from './csv';
import type { ColumnMapping } from './importTasks';

/**
 * Microsoft Project XML (MSPDI) reader: turns a saved .xml project into the same table the CSV
 * importer uses, so every screen works unchanged.
 *
 * Element names and formats were checked against Microsoft's "XML Data Interchange" reference:
 * Task children UID, ID, Name, Summary (boolean), WBS, Start, Finish, ActualFinish (date-times such as
 * 2007-11-14T08:00:00), Work and ActualWork (durations such as PT16H0M0S), PercentComplete (of duration),
 * PercentWorkComplete (of work), Baseline (Number, Start, Finish, Work); Resources/Resource; and
 * Assignments/Assignment (TaskUID, ResourceUID). Microsoft's page does NOT say what a baseline Number means;
 * this reader treats Number 0 as the main baseline (how Project numbers it), says so, and the user can check.
 *
 * Rules (nothing is guessed):
 *  - summary tasks are left out: their work repeats their sub-tasks' and would be counted twice;
 *  - planned hours/dates come from the main baseline when the file has one, otherwise from the current
 *    schedule (which moves when the plan is edited; stated);
 *  - progress uses PercentWorkComplete when present, otherwise PercentComplete (stated);
 *  - a value that is not in the documented form (for example a duration with days) is left blank and counted;
 *  - a task assigned to several people lists them separated by "; " (the app then does not split hours);
 *  - files with a DOCTYPE or ENTITY declaration are refused.
 */
export interface MspdiResult {
  table: CsvResult;
  /** Plain-language notes about how the file was read, to show on screen. */
  notes: string[];
  /** Column choices that fit the table made here. */
  mapping: Partial<ColumnMapping>;
}

const HEADERS = ['ID', 'WBS', 'Name', 'Estimate (h)', 'Actual (h)', '% Complete', 'Start', 'Finish', 'Actual finish', 'Assignee'];

const isTrue = (v: unknown) => v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const num = (x: number) => String(Math.round(x * 10000) / 10000);

/** PT16H0M0S -> 16. Anything else (days, weeks, junk) is not read. */
export function parseWorkHours(v: unknown): number | null {
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(str(v));
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Number(m[1] ?? 0) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600;
}
/** 2026-01-05T08:00:00 -> 2026-01-05 (real calendar dates only). */
export function parseMspdiDate(v: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(str(v));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

interface Node { [k: string]: unknown }
const asNode = (v: unknown): Node => (typeof v === 'object' && v !== null ? (v as Node) : {});

export function parseMspdi(xml: string): MspdiResult {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('This file contains a DOCTYPE or ENTITY declaration, which a Microsoft Project file does not have. It was not read.');
  const parser = new XMLParser({
    ignoreAttributes: true, parseTagValue: false, trimValues: true,
    processEntities: { enabled: true, maxEntityCount: 10, maxEntitySize: 100, maxTotalExpansions: 500_000, maxExpandedLength: 20_000_000 },
    isArray: (name) => ['Task', 'Resource', 'Assignment', 'Baseline'].includes(name),
  });
  let doc: Node;
  try { doc = asNode(parser.parse(xml)); } catch { throw new Error('This file is not valid XML, so it could not be read.'); }
  const project = asNode(doc.Project);
  if (Object.keys(project).length === 0) throw new Error('This does not look like a Microsoft Project XML file (there is no Project element). Save the plan in Project as "XML Format (*.xml)".');

  const tasks = arr(asNode(project.Tasks).Task).map(asNode);
  const resources = new Map<string, string>();
  for (const r of arr(asNode(project.Resources).Resource).map(asNode)) {
    const uid = str(r.UID), name = str(r.Name);
    if (uid !== '' && name !== '') resources.set(uid, name);
  }
  const people = new Map<string, string[]>();
  let unknownResource = 0;
  for (const a of arr(asNode(project.Assignments).Assignment).map(asNode)) {
    const t = str(a.TaskUID), r = str(a.ResourceUID);
    if (t === '' || r === '') continue;
    const name = resources.get(r);
    if (name === undefined) { unknownResource += 1; continue; }
    const list = people.get(t) ?? [];
    if (!list.includes(name)) list.push(name);
    people.set(t, list);
  }

  // Which baseline? Number 0 if present; otherwise the only number used; otherwise none.
  const baselineNumbers = new Set<string>();
  for (const t of tasks) for (const b of arr(t.Baseline as unknown).map(asNode)) baselineNumbers.add(str(b.Number));
  const useBaseline = baselineNumbers.has('0') ? '0' : baselineNumbers.size === 1 ? [...baselineNumbers][0] ?? null : null;
  const hasWorkPct = tasks.some((t) => str(t.PercentWorkComplete) !== '');

  let summary = 0, unnamed = 0, badDuration = 0, badDate = 0, noBaseline = 0;
  const rows: string[][] = [];
  for (const t of tasks) {
    if (isTrue(t.Summary)) { summary += 1; continue; }
    const name = str(t.Name);
    if (name === '') { unnamed += 1; continue; }
    const base = useBaseline === null ? null : arr(t.Baseline as unknown).map(asNode).find((b) => str(b.Number) === useBaseline) ?? null;
    if (useBaseline !== null && base === null) noBaseline += 1;
    const src = useBaseline === null ? t : base ?? {};
    const hours = (v: unknown): string => {
      if (str(v) === '') return '';
      const h = parseWorkHours(v);
      if (h === null) { badDuration += 1; return ''; }
      return num(h);
    };
    const date = (v: unknown): string => {
      if (str(v) === '') return '';
      const d = parseMspdiDate(v);
      if (d === null) { badDate += 1; return ''; }
      return d;
    };
    const pct = str(hasWorkPct ? t.PercentWorkComplete : t.PercentComplete);
    const uid = str(t.UID);
    rows.push([
      str(t.ID) || uid, str(t.WBS), name, hours(src.Work), hours(t.ActualWork), pct, date(src.Start), date(src.Finish),
      date(t.ActualFinish), (people.get(uid) ?? []).join('; '),
    ]);
  }

  const notes: string[] = [`Read ${rows.length} task${rows.length === 1 ? '' : 's'} from the Microsoft Project XML file.`];
  if (summary > 0) notes.push(`${summary} summary task${summary === 1 ? ' was' : 's were'} left out: their work repeats their sub-tasks' and would be counted twice.`);
  if (unnamed > 0) notes.push(`${unnamed} task${unnamed === 1 ? ' has' : 's have'} no name and ${unnamed === 1 ? 'was' : 'were'} left out.`);
  if (useBaseline === null) notes.push('The file has no saved baseline, so planned work and dates come from the current schedule. That changes whenever the plan is edited, so earned value is less reliable. Save a baseline in Project for a firmer result.');
  else notes.push(`Planned work and dates come from baseline number ${useBaseline}. Microsoft's reference does not say what the baseline number means; Project normally numbers the main baseline 0. Please check this against your plan.${noBaseline > 0 ? ` ${noBaseline} task${noBaseline === 1 ? ' has' : 's have'} no values in that baseline and will be left out.` : ''}`);
  notes.push(hasWorkPct ? 'Progress uses "% work complete" (the share of the work done).' : 'Progress uses "% complete" (the share of the duration), because the file has no "% work complete".');
  if (baselineNumbers.size > 1) notes.push('The file has more than one saved baseline; only one is used.');
  if (badDuration > 0) notes.push(`${badDuration} work value${badDuration === 1 ? ' was' : 's were'} not in the documented hours-minutes-seconds form and ${badDuration === 1 ? 'was' : 'were'} left blank.`);
  if (badDate > 0) notes.push(`${badDate} date${badDate === 1 ? ' was' : 's were'} not readable and ${badDate === 1 ? 'was' : 'were'} left blank.`);
  if (unknownResource > 0) notes.push(`${unknownResource} assignment${unknownResource === 1 ? ' points' : 's point'} to a resource that is not in the file and ${unknownResource === 1 ? 'was' : 'were'} not used.`);
  if (people.size === 0) notes.push('No resource assignments were found, so the Assignee column is empty.');
  notes.push('A task assigned to several people lists them separated by "; "; the Resources and Cost tabs do not split hours between people.');

  return {
    table: { delimiter: ',', headers: HEADERS, rows, warnings: [] },
    notes,
    mapping: { id: 'ID', name: 'Name', status: null, planned: 'Estimate (h)', actual: 'Actual (h)', percent: '% Complete', start: 'Start', finish: 'Finish' },
  };
}
