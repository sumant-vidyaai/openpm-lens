import type { DataIssue, Quantity, Unit } from './model';

/**
 * Safe parsing of quantities that arrive as text, such as "8.5 Hours" or "2d".
 *
 * Principles:
 *  - The raw text is always kept.
 *  - Anything ambiguous or unrecognised becomes null with a recorded issue. We never guess.
 *  - A number with no unit keeps `unit: null` unless the caller passes an explicit
 *    `defaultUnit`. We do not assume hours.
 */

const UNIT_ALIASES: Record<string, Unit> = {
  s: 'seconds',
  sec: 'seconds',
  secs: 'seconds',
  second: 'seconds',
  seconds: 'seconds',
  min: 'minutes',
  mins: 'minutes',
  minute: 'minutes',
  minutes: 'minutes',
  h: 'hours',
  hr: 'hours',
  hrs: 'hours',
  hour: 'hours',
  hours: 'hours',
  d: 'days',
  day: 'days',
  days: 'days',
  w: 'weeks',
  wk: 'weeks',
  wks: 'weeks',
  week: 'weeks',
  weeks: 'weeks',
  pt: 'points',
  pts: 'points',
  point: 'points',
  points: 'points',
  sp: 'points',
};

/** How numbers are written in the file. 'auto' reads only unambiguous ones; 'point' is 1,234.5; 'comma' is 1.234,5. */
export type DecimalStyle = 'auto' | 'point' | 'comma';

export interface ParseQuantityOptions {
  /** Decimal style the person chose for this file. Defaults to 'auto'. */
  decimal?: DecimalStyle;
  /** Used only when the text has a number but no unit. Must be passed explicitly. */
  defaultUnit?: Unit;
  /** Canonical field name recorded on any issues. */
  field?: string;
}

interface NumberParse {
  value: number | null;
  issue: { code: DataIssue['code']; message: string } | null;
}

function parseNumber(text: string, decimal: DecimalStyle = 'auto'): NumberParse {
  const s = text.trim();

  // The person said how numbers are written, so nothing is ambiguous: read strictly in that style or refuse.
  if (decimal === 'comma') {
    if (/^-?\d+(,\d+)?$/.test(s)) return { value: Number(s.replace(',', '.')), issue: null };
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return { value: Number(s.replace(/\./g, '').replace(',', '.')), issue: null };
    return { value: null, issue: { code: 'unparseable', message: `"${s}" is not a number written with a decimal comma (like 1.234,5).` } };
  }
  if (decimal === 'point') {
    if (/^-?\d+(\.\d+)?$/.test(s) || /^-?\.\d+$/.test(s)) return { value: Number(s), issue: null };
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return { value: Number(s.replace(/,/g, '')), issue: null };
    return { value: null, issue: { code: 'unparseable', message: `"${s}" is not a number written with a decimal point (like 1,234.5).` } };
  }

  // Plain: 12, -3.5, .5
  if (/^-?\d+(\.\d+)?$/.test(s) || /^-?\.\d+$/.test(s)) {
    return { value: Number(s), issue: null };
  }

  // Commas used as thousands separators.
  if (s.includes(',')) {
    const hasDot = s.includes('.');
    const thousandsWithDot = /^-?\d{1,3}(,\d{3})+\.\d+$/;
    const thousandsMulti = /^-?\d{1,3}(,\d{3}){2,}$/;
    if (hasDot && thousandsWithDot.test(s)) {
      return { value: Number(s.replace(/,/g, '')), issue: null };
    }
    if (!hasDot && thousandsMulti.test(s)) {
      return { value: Number(s.replace(/,/g, '')), issue: null };
    }
    // A single comma with no dot ("8,5" or "1,234") could be a decimal comma or a
    // thousands separator. We cannot know which, so we refuse to guess.
    if (!hasDot && /^-?\d+,\d+$/.test(s)) {
      return {
        value: null,
        issue: {
          code: 'ambiguous_decimal',
          message: `"${s}" could be a decimal comma or a thousands separator; not parsed.`,
        },
      };
    }
  }

  return {
    value: null,
    issue: { code: 'unparseable', message: `"${s}" is not a recognisable number.` },
  };
}

export function parseQuantity(
  input: string | number | null | undefined,
  options: ParseQuantityOptions = {},
): Quantity {
  const field = options.field ?? 'quantity';
  const issues: DataIssue[] = [];

  if (input === null || input === undefined) {
    return {
      raw: null,
      value: null,
      unit: null,
      issues: [{ code: 'missing_value', field, message: 'No value was supplied.' }],
    };
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return {
        raw: String(input),
        value: null,
        unit: null,
        issues: [{ code: 'unparseable', field, message: 'Number is not finite.' }],
      };
    }
    const q: Quantity = {
      raw: String(input),
      value: input,
      unit: options.defaultUnit ?? null,
      issues,
    };
    if (input < 0) {
      issues.push({ code: 'negative_value', field, message: 'Value is negative.' });
    }
    return q;
  }

  const raw = input;
  const text = raw.trim();
  if (text === '') {
    return {
      raw,
      value: null,
      unit: null,
      issues: [{ code: 'missing_value', field, message: 'The cell was empty.' }],
    };
  }

  // Exactly one number, optionally followed by one unit word.
  const match = /^(-?[\d.,]+)\s*([A-Za-z]*)$/.exec(text);
  if (!match) {
    const tokenCount = (text.match(/[\d.,]+\s*[A-Za-z]+/g) ?? []).length;
    const message =
      tokenCount > 1
        ? `"${text}" looks like a compound duration (for example "1h 30m"), which is not supported yet; not parsed.`
        : `"${text}" is not a recognisable quantity.`;
    return { raw, value: null, unit: null, issues: [{ code: 'unparseable', field, message }] };
  }

  const numberText = match[1] ?? '';
  const unitText = (match[2] ?? '').toLowerCase();

  const parsed = parseNumber(numberText, options.decimal ?? 'auto');
  if (parsed.value === null) {
    const issue = parsed.issue ?? { code: 'unparseable' as const, message: 'Not a number.' };
    return { raw, value: null, unit: null, issues: [{ ...issue, field }] };
  }

  let unit: Unit | null = null;
  if (unitText === '') {
    unit = options.defaultUnit ?? null;
  } else {
    const known = UNIT_ALIASES[unitText];
    if (known === undefined) {
      return {
        raw,
        value: null,
        unit: null,
        issues: [
          { code: 'unknown_unit', field, message: `Unit "${unitText}" is not recognised; not parsed.` },
        ],
      };
    }
    unit = known;
  }

  if (parsed.value < 0) {
    issues.push({ code: 'negative_value', field, message: 'Value is negative.' });
  }

  return { raw, value: parsed.value, unit, issues };
}

/** Working-time assumptions needed to convert days and weeks into hours. Always explicit. */
export interface WorkCalendar {
  hoursPerDay: number;
  daysPerWeek: number;
}

/**
 * Convert a time quantity to hours.
 * Returns null if the value is missing or the unit is not a time unit (for example points).
 * The calendar is required: the length of a "day" is an assumption the user must own.
 */
export function convertToHours(quantity: Quantity, calendar: WorkCalendar): number | null {
  if (!(calendar.hoursPerDay > 0) || !(calendar.daysPerWeek > 0)) {
    throw new RangeError('calendar.hoursPerDay and calendar.daysPerWeek must be greater than 0');
  }
  if (quantity.value === null || quantity.unit === null) return null;
  switch (quantity.unit) {
    case 'seconds':
      return quantity.value / 3600;
    case 'minutes':
      return quantity.value / 60;
    case 'hours':
      return quantity.value;
    case 'days':
      return quantity.value * calendar.hoursPerDay;
    case 'weeks':
      return quantity.value * calendar.daysPerWeek * calendar.hoursPerDay;
    case 'points':
      return null;
  }
}
