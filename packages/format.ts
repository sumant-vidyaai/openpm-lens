/**
 * Round a number to `decimals` places for DISPLAY, rounding halves away from zero.
 *
 * Why not toFixed()? Binary floating point stores 0.725 as 0.72499999..., so
 * (0.725).toFixed(2) can give "0.72" when a person doing the sum by hand expects 0.73.
 * Adding Number.EPSILON nudges such "exact halves" the way a spreadsheet would.
 *
 * Limitation: this is for showing results. Calculations always use unrounded values.
 */
export function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError('decimals must be a non-negative integer');
  }
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
  return sign * rounded;
}
