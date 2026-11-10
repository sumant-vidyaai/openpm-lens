/**
 * Earned Value Management (EVM) formulas.
 *
 * Conventions:
 *  - Pure functions: numbers in, number out. No side effects.
 *  - Where a result is mathematically undefined (division by zero, non-finite input) the
 *    function returns null. It never returns NaN, Infinity or a made-up number.
 *  - Inputs are unrounded. Round only for display (see format.ts).
 *
 * Abbreviations: PV planned value, EV earned value, AC actual cost, BAC budget at
 * completion, EAC estimate at completion, ETC estimate to complete, VAC variance at
 * completion, CPI cost performance index, SPI schedule performance index,
 * TCPI to-complete performance index.
 */

function finite(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v));
}

/** a / b, or null if either is not finite or b is zero. */
export function safeDivide(a: number, b: number): number | null {
  if (!finite(a, b) || b === 0) return null;
  return a / b;
}

/** Schedule variance: SV = EV - PV. Negative means behind schedule. */
export function scheduleVariance(ev: number, pv: number): number | null {
  return finite(ev, pv) ? ev - pv : null;
}

/** Cost variance: CV = EV - AC. Negative means over budget. */
export function costVariance(ev: number, ac: number): number | null {
  return finite(ev, ac) ? ev - ac : null;
}

/** Schedule performance index: SPI = EV / PV. Below 1.0 means behind schedule. */
export function schedulePerformanceIndex(ev: number, pv: number): number | null {
  return safeDivide(ev, pv);
}

/** Cost performance index: CPI = EV / AC. Below 1.0 means over budget. */
export function costPerformanceIndex(ev: number, ac: number): number | null {
  return safeDivide(ev, ac);
}

/** Schedule variance percent: SV% = SV / PV. */
export function scheduleVariancePercent(ev: number, pv: number): number | null {
  const sv = scheduleVariance(ev, pv);
  return sv === null ? null : safeDivide(sv, pv);
}

/** Cost variance percent: CV% = CV / EV. */
export function costVariancePercent(ev: number, ac: number): number | null {
  const cv = costVariance(ev, ac);
  return cv === null ? null : safeDivide(cv, ev);
}

/** Percent complete (budget basis): EV / BAC. Returned as a fraction (0.4 = 40%). */
export function percentCompleteBudget(ev: number, bac: number): number | null {
  return safeDivide(ev, bac);
}

/** Percent spent: AC / BAC. Returned as a fraction. */
export function percentSpent(ac: number, bac: number): number | null {
  return safeDivide(ac, bac);
}

/**
 * EAC, variant 1 (atypical variance): EAC = AC + (BAC - EV).
 * Use when the cost variance so far was a one-off and the rest will go to plan.
 */
export function eacAtypical(bac: number, ev: number, ac: number): number | null {
  return finite(bac, ev, ac) ? ac + (bac - ev) : null;
}

/**
 * EAC, variant 2 (typical variance): EAC = BAC / CPI.
 * Use when the cost performance so far is expected to continue.
 */
export function eacTypical(bac: number, ev: number, ac: number): number | null {
  const cpi = costPerformanceIndex(ev, ac);
  if (cpi === null) return null;
  return safeDivide(bac, cpi);
}

/**
 * EAC, variant 3 (cost and schedule both influence the outcome):
 * EAC = AC + (BAC - EV) / (CPI x SPI).
 */
export function eacCpiSpi(bac: number, ev: number, ac: number, pv: number): number | null {
  const cpi = costPerformanceIndex(ev, ac);
  const spi = schedulePerformanceIndex(ev, pv);
  if (cpi === null || spi === null || !finite(bac)) return null;
  const remainingPerformance = safeDivide(bac - ev, cpi * spi);
  return remainingPerformance === null ? null : ac + remainingPerformance;
}

/**
 * EAC, variant 4 (bottom-up): EAC = AC + a fresh bottom-up estimate to complete.
 * The bottom-up ETC comes from the team, not from a formula.
 */
export function eacBottomUp(ac: number, bottomUpEtc: number): number | null {
  return finite(ac, bottomUpEtc) ? ac + bottomUpEtc : null;
}

/** Estimate to complete: ETC = EAC - AC. */
export function estimateToComplete(eac: number, ac: number): number | null {
  return finite(eac, ac) ? eac - ac : null;
}

/** Variance at completion: VAC = BAC - EAC. Negative means a forecast overrun. */
export function varianceAtCompletion(bac: number, eac: number): number | null {
  return finite(bac, eac) ? bac - eac : null;
}

/**
 * To-complete performance index against the original budget:
 * TCPI(BAC) = (BAC - EV) / (BAC - AC).
 * The CPI the team must achieve on remaining work to finish within BAC.
 * Null when BAC equals AC (the budget is exactly used up, so the ratio is undefined).
 */
export function tcpiToBac(bac: number, ev: number, ac: number): number | null {
  if (!finite(bac, ev, ac)) return null;
  return safeDivide(bac - ev, bac - ac);
}

/**
 * To-complete performance index against a revised forecast:
 * TCPI(EAC) = (BAC - EV) / (EAC - AC).
 */
export function tcpiToEac(bac: number, ev: number, ac: number, eac: number): number | null {
  if (!finite(bac, ev, ac, eac)) return null;
  return safeDivide(bac - ev, eac - ac);
}
