/**
 * Three-point (PERT) estimates. For each task: optimistic O, most likely M, pessimistic P.
 *   expected = (O + 4M + P) / 6      standard deviation = (P - O) / 6      variance = SD squared
 * (checked against a published PERT guide; worked example O 4, M 7, P 10 gives 7 and 1).
 * A project total adds the expected values and, ASSUMING the tasks are independent, the variances; its standard deviation is the square root of that sum.
 * A task without all three numbers in order (O <= M <= P) is left out and listed, never filled in.
 */
export interface ThreePointInput { id: string; optimistic: number | null; mostLikely: number | null; pessimistic: number | null }
export interface ThreePointRow { id: string; o: number | null; m: number | null; p: number | null; expected: number | null; sd: number | null; used: boolean; note: string }
export interface ThreePointResult {
  rows: ThreePointRow[];
  used: number; leftOut: number;
  /** Sums over the used tasks only, so the two totals compare like with like. */
  sumMostLikely: number | null;
  sumExpected: number | null;
  /** Standard deviation of the total, assuming independent tasks. */
  sd: number | null;
  /** Expected total plus or minus 1 and 2 standard deviations. */
  range1: [number, number] | null;
  range2: [number, number] | null;
}

export function pertEstimate(o: number, m: number, p: number): { expected: number; sd: number; variance: number } {
  const sd = (p - o) / 6;
  return { expected: (o + 4 * m + p) / 6, sd, variance: sd * sd };
}

const ok = (x: number | null): x is number => x !== null && Number.isFinite(x) && x >= 0;

export function analyseThreePoint(inputs: ThreePointInput[]): ThreePointResult {
  const rows: ThreePointRow[] = inputs.map((t) => {
    const base = { id: t.id, o: t.optimistic, m: t.mostLikely, p: t.pessimistic };
    if (t.optimistic === null && t.pessimistic === null) return { ...base, expected: null, sd: null, used: false, note: 'Left out: no optimistic or pessimistic value' };
    if (!ok(t.optimistic) || !ok(t.mostLikely) || !ok(t.pessimistic)) return { ...base, expected: null, sd: null, used: false, note: 'Left out: one of the three values is missing or not a number of zero or more' };
    if (!(t.optimistic <= t.mostLikely && t.mostLikely <= t.pessimistic)) return { ...base, expected: null, sd: null, used: false, note: 'Left out: the values are not in order (optimistic <= most likely <= pessimistic)' };
    const e = pertEstimate(t.optimistic, t.mostLikely, t.pessimistic);
    return { ...base, expected: e.expected, sd: e.sd, used: true, note: '' };
  });
  const used = rows.filter((r) => r.used);
  if (used.length === 0) return { rows, used: 0, leftOut: rows.length, sumMostLikely: null, sumExpected: null, sd: null, range1: null, range2: null };
  const sumM = used.reduce((a, r) => a + (r.m as number), 0);
  const sumE = used.reduce((a, r) => a + (r.expected as number), 0);
  const sd = Math.sqrt(used.reduce((a, r) => a + (r.sd as number) ** 2, 0));
  return {
    rows, used: used.length, leftOut: rows.length - used.length,
    sumMostLikely: sumM, sumExpected: sumE, sd,
    range1: [sumE - sd, sumE + sd], range2: [sumE - 2 * sd, sumE + 2 * sd],
  };
}
