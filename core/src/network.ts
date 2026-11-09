import { dayCounter, type DayRule } from './dates';

/**
 * Critical path method for a plan where each task has a duration in counted days and finish-to-start dependencies.
 * Offsets are whole counted days from the project start: a task with start offset s and duration d occupies counted days s .. s+d-1,
 * and its finish offset is s+d (the first day after it). Rules (checked against two published teaching sources):
 *   forward pass  - early start = the largest early finish of the predecessors (0 with none); early finish = early start + duration
 *   backward pass - late finish = the smallest late start of the successors (the project finish with none); late start = late finish - duration
 *   total float = late start - early start (= late finish - early finish); free float = the smallest early start of the successors - early finish
 *   critical = total float of 0. The critical path is the longest path through the network.
 * Only finish-to-start links with no lag or lead are supported.
 */
export interface NetworkTask { id: string; duration: number; preds: string[] }

export interface NetworkRow {
  id: string; duration: number;
  es: number; ef: number; ls: number; lf: number;
  totalFloat: number; freeFloat: number; critical: boolean;
  /** Task ids that must finish first (after dropping unknown and duplicate ones). */
  preds: string[];
}
export interface NetworkProblem { code: 'unknown_predecessor' | 'self_dependency' | 'duplicate_id' | 'bad_duration' | 'cycle'; ids: string[]; message: string }
export interface NetworkResult {
  /** Rows in order of early start. Empty when the network cannot be worked out (see problems). */
  rows: NetworkRow[];
  /** Project length in counted days (the largest early finish). */
  duration: number;
  problems: NetworkProblem[];
  /** True when a cycle or another fault stopped the calculation. */
  failed: boolean;
}

export function analyseNetwork(tasks: NetworkTask[]): NetworkResult {
  const problems: NetworkProblem[] = [];
  const seen = new Set<string>();
  const list: NetworkTask[] = [];
  const dup: string[] = [], bad: string[] = [];
  for (const t of tasks) {
    if (seen.has(t.id)) { dup.push(t.id); continue; }
    seen.add(t.id);
    if (!Number.isFinite(t.duration) || t.duration < 0) { bad.push(t.id); continue; }
    list.push(t);
  }
  if (dup.length) problems.push({ code: 'duplicate_id', ids: dup, message: `${dup.length} task${dup.length === 1 ? ' repeats' : 's repeat'} an ID already used; only the first of each is used.` });
  if (bad.length) problems.push({ code: 'bad_duration', ids: bad, message: `${bad.length} task${bad.length === 1 ? ' has' : 's have'} no usable duration and ${bad.length === 1 ? 'is' : 'are'} left out of the network.` });
  const known = new Set(list.map((t) => t.id));
  const unknown = new Set<string>(), selfDep: string[] = [];
  const preds = new Map<string, string[]>();
  for (const t of list) {
    const p: string[] = [];
    for (const x of t.preds) {
      if (x === t.id) { if (!selfDep.includes(t.id)) selfDep.push(t.id); continue; }
      if (!known.has(x)) { unknown.add(`${t.id} <- ${x}`); continue; }
      if (!p.includes(x)) p.push(x);
    }
    preds.set(t.id, p);
  }
  if (unknown.size) problems.push({ code: 'unknown_predecessor', ids: [...unknown], message: `${unknown.size} link${unknown.size === 1 ? ' points' : 's point'} to a task that is not in the network (missing, cancelled or left out) and ${unknown.size === 1 ? 'was' : 'were'} ignored.` });
  if (selfDep.length) problems.push({ code: 'self_dependency', ids: selfDep, message: `${selfDep.length} task${selfDep.length === 1 ? ' depends' : 's depend'} on ${selfDep.length === 1 ? 'itself' : 'themselves'}; that link was ignored.` });

  // Order tasks so every task comes after its predecessors (Kahn's method). Anything left over is in, or after, a cycle.
  const indeg = new Map<string, number>(), succ = new Map<string, string[]>();
  for (const t of list) { indeg.set(t.id, (preds.get(t.id) ?? []).length); succ.set(t.id, []); }
  for (const t of list) for (const p of preds.get(t.id) ?? []) succ.get(p)!.push(t.id);
  const order: string[] = [];
  const queue = list.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const s of succ.get(id) ?? []) { indeg.set(s, (indeg.get(s) ?? 0) - 1); if (indeg.get(s) === 0) queue.push(s); }
  }
  if (order.length < list.length) {
    const stuck = list.filter((t) => !order.includes(t.id)).map((t) => t.id);
    problems.push({ code: 'cycle', ids: stuck, message: `The links form a loop (a task that, through other tasks, depends on itself), so no path can be worked out. Tasks in or after the loop: ${stuck.slice(0, 8).join(', ')}${stuck.length > 8 ? ', ...' : ''}.` });
    return { rows: [], duration: 0, problems, failed: true };
  }

  const dur = new Map(list.map((t) => [t.id, t.duration]));
  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const id of order) {
    const s = Math.max(0, ...(preds.get(id) ?? []).map((p) => ef.get(p) as number));
    es.set(id, s); ef.set(id, s + (dur.get(id) as number));
  }
  const duration = Math.max(0, ...[...ef.values()]);
  const ls = new Map<string, number>(), lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const s = succ.get(id) ?? [];
    const f = s.length === 0 ? duration : Math.min(...s.map((x) => ls.get(x) as number));
    lf.set(id, f); ls.set(id, f - (dur.get(id) as number));
  }
  const rows: NetworkRow[] = order.map((id) => {
    const s = succ.get(id) ?? [];
    const free = (s.length === 0 ? duration : Math.min(...s.map((x) => es.get(x) as number))) - (ef.get(id) as number);
    const tf = (ls.get(id) as number) - (es.get(id) as number);
    return { id, duration: dur.get(id) as number, es: es.get(id) as number, ef: ef.get(id) as number, ls: ls.get(id) as number, lf: lf.get(id) as number, totalFloat: tf, freeFloat: free, critical: tf === 0, preds: preds.get(id) ?? [] };
  });
  rows.sort((a, b) => a.es - b.es || a.ef - b.ef || a.id.localeCompare(b.id));
  return { rows, duration, problems, failed: false };
}

/**
 * Reads a "Depends on" cell: task ids separated by commas or semicolons. Ids may contain hyphens (W-8) and dots.
 * Anything written like a lag, lead or link type ("5+2d", "5SS", "5FS", "A: 2d", an id with a space) is reported and not used, never guessed.
 */
export function parseDependsOn(text: string | null | undefined): { ids: string[]; unsupported: string[] } {
  const ids: string[] = [], unsupported: string[] = [];
  for (const raw of (text ?? '').split(/[,;]/)) {
    const t = raw.trim();
    if (t === '') continue;
    if (/\s|\+|:/.test(t) || /\d(SS|FF|SF|FS)$/i.test(t)) { unsupported.push(t); continue; }
    if (!ids.includes(t)) ids.push(t);
  }
  return { ids, unsupported };
}

/** Date of the counted day with this 0-based index, counting from `start` (start itself counts if it is a counted day). */
export function countedDayDate(start: string, index: number, rule: DayRule): string {
  const DAY = 86_400_000;
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  let t = Date.UTC(y, m - 1, d);
  const counted = dayCounter(rule);
  let n = -1;
  for (let guard = 0; guard < 100_000; guard++) {
    if (counted(t)) { n += 1; if (n === Math.max(0, index)) return new Date(t).toISOString().slice(0, 10); }
    t += DAY;
  }
  return new Date(t).toISOString().slice(0, 10);
}
