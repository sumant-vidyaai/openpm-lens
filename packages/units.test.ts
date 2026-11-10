import { describe, expect, it } from 'vitest';
import { convertToHours, parseQuantity } from '../src/units';

describe('parseQuantity', () => {
  it('parses "8.5 Hours" and keeps the raw text', () => {
    const q = parseQuantity('8.5 Hours');
    expect(q.raw).toBe('8.5 Hours');
    expect(q.value).toBe(8.5);
    expect(q.unit).toBe('hours');
    expect(q.issues).toEqual([]);
  });

  it('accepts short unit forms and any letter case', () => {
    expect(parseQuantity('2d')).toMatchObject({ value: 2, unit: 'days' });
    expect(parseQuantity('3 HRS')).toMatchObject({ value: 3, unit: 'hours' });
    expect(parseQuantity('1.5 wks')).toMatchObject({ value: 1.5, unit: 'weeks' });
    expect(parseQuantity('30 min')).toMatchObject({ value: 30, unit: 'minutes' });
    expect(parseQuantity('5 pts')).toMatchObject({ value: 5, unit: 'points' });
  });

  it('handles thousands separators when unambiguous', () => {
    expect(parseQuantity('1,234.5 hrs')).toMatchObject({ value: 1234.5, unit: 'hours' });
    expect(parseQuantity('1,234,567 hours').value).toBe(1234567);
  });

  it('refuses to guess ambiguous commas', () => {
    const decimalComma = parseQuantity('8,5 Hours');
    expect(decimalComma.value).toBeNull();
    expect(decimalComma.issues[0]?.code).toBe('ambiguous_decimal');

    const maybeThousands = parseQuantity('1,234 hours');
    expect(maybeThousands.value).toBeNull();
    expect(maybeThousands.issues[0]?.code).toBe('ambiguous_decimal');
  });

  it('treats empty and missing input as missing, not zero', () => {
    for (const input of ['', '   ', null, undefined]) {
      const q = parseQuantity(input);
      expect(q.value).toBeNull();
      expect(q.issues[0]?.code).toBe('missing_value');
    }
  });

  it('flags unparseable text', () => {
    const q = parseQuantity('abc');
    expect(q.value).toBeNull();
    expect(q.issues[0]?.code).toBe('unparseable');
  });

  it('flags unknown units instead of guessing', () => {
    const q = parseQuantity('3 fortnights');
    expect(q.value).toBeNull();
    expect(q.issues[0]?.code).toBe('unknown_unit');
  });

  it('declines compound durations and says why', () => {
    const q = parseQuantity('1h 30m');
    expect(q.value).toBeNull();
    expect(q.issues[0]?.code).toBe('unparseable');
    expect(q.issues[0]?.message).toContain('compound');
  });

  it('does not assume a unit unless told to', () => {
    expect(parseQuantity(5).unit).toBeNull();
    expect(parseQuantity('5').unit).toBeNull();
    expect(parseQuantity('5', { defaultUnit: 'hours' }).unit).toBe('hours');
  });

  it('keeps negative values but flags them', () => {
    const q = parseQuantity('-2 hours');
    expect(q.value).toBe(-2);
    expect(q.issues[0]?.code).toBe('negative_value');
  });
});

describe('convertToHours', () => {
  const calendar = { hoursPerDay: 8, daysPerWeek: 5 };

  it('converts each time unit using the explicit calendar', () => {
    expect(convertToHours(parseQuantity('90 min'), calendar)).toBe(1.5);
    expect(convertToHours(parseQuantity('8.5 hours'), calendar)).toBe(8.5);
    expect(convertToHours(parseQuantity('2 days'), calendar)).toBe(16);
    expect(convertToHours(parseQuantity('1.5 weeks'), calendar)).toBe(60);
  });

  it('uses the calendar the caller supplies', () => {
    expect(convertToHours(parseQuantity('1 day'), { hoursPerDay: 7.5, daysPerWeek: 5 })).toBe(7.5);
  });

  it('returns null for missing values, points and unitless numbers', () => {
    expect(convertToHours(parseQuantity(''), calendar)).toBeNull();
    expect(convertToHours(parseQuantity('5 pts'), calendar)).toBeNull();
    expect(convertToHours(parseQuantity('5'), calendar)).toBeNull();
  });

  it('rejects a nonsensical calendar', () => {
    expect(() => convertToHours(parseQuantity('1 day'), { hoursPerDay: 0, daysPerWeek: 5 })).toThrow(
      RangeError,
    );
  });
});
