/**
 * How a metric result is reported. This is the heart of the "never fake a number" rule.
 *
 * - computed: every needed input was present and valid.
 * - computed_with_caveats: a number exists, but some records were excluded or an
 *   assumption was applied. The caveats array says exactly what.
 * - not_available: no number can be produced. `missing` names the exact fields.
 */
export type MetricStatus = 'computed' | 'computed_with_caveats' | 'not_available';

export interface MetricResult {
  status: MetricStatus;
  /** The number, or null when status is not_available (or the result is mathematically undefined). */
  value: number | null;
  /** Human-readable notes about exclusions and assumptions. Empty when status is computed. */
  caveats: string[];
  /** Canonical field names that were needed but absent. */
  missing: string[];
}
