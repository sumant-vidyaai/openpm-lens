/**
 * A metric recipe card: one metric declared as data.
 * Cards live as YAML files in packages/registry/metrics/.
 */
export interface MetricCard {
  id: string;
  name: string;
  /** Broad grouping of the metric (for example Schedule, Finance), used to organise the dashboard. */
  domain: string;
  /** Second, more traditional grouping (for example Cost, Schedule), so the metric can be found either way. */
  area: string;
  formula: string;
  /** Plain-language meaning. */
  meaning: string;
  /** Canonical inputs the metric cannot be computed without. */
  required: string[];
  optional: string[];
  interpretation: {
    /** Must state that thresholds are starting values, not a standard. */
    note: string;
    bands: { label: string; rule: string }[];
  };
  worked_example: {
    inputs: Record<string, number>;
    /** Step-by-step walkthrough shown to the user, like a spreadsheet walkthrough. */
    steps: string[];
    expected: number;
    /** Decimal places the expected value is accurate to. */
    decimals: number;
  };
}

const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'domain',
  'area',
  'formula',
  'meaning',
] as const;

/** Returns a list of problems. An empty list means the card is structurally valid. */
export function validateCard(card: unknown): string[] {
  const errors: string[] = [];
  if (typeof card !== 'object' || card === null) return ['card is not an object'];
  const c = card as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof c[field] !== 'string' || (c[field] as string).trim() === '') {
      errors.push(`"${field}" must be a non-empty string`);
    }
  }
  for (const field of ['required', 'optional'] as const) {
    const value = c[field];
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
      errors.push(`"${field}" must be a list of strings`);
    }
  }
  if (Array.isArray(c.required) && c.required.length === 0) {
    errors.push('"required" must name at least one input');
  }

  const interp = c.interpretation as Record<string, unknown> | undefined;
  if (!interp || typeof interp.note !== 'string' || !Array.isArray(interp.bands)) {
    errors.push('"interpretation" needs a note and a list of bands');
  } else if (!/not a standard/i.test(interp.note)) {
    errors.push('"interpretation.note" must say the thresholds are not a standard');
  }

  const ex = c.worked_example as Record<string, unknown> | undefined;
  if (!ex) {
    errors.push('"worked_example" is required');
  } else {
    if (typeof ex.inputs !== 'object' || ex.inputs === null) errors.push('worked_example.inputs missing');
    if (!Array.isArray(ex.steps) || ex.steps.length === 0) errors.push('worked_example.steps missing');
    if (typeof ex.expected !== 'number') errors.push('worked_example.expected must be a number');
    if (typeof ex.decimals !== 'number') errors.push('worked_example.decimals must be a number');
  }
  return errors;
}
