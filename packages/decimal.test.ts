import { describe, expect, it } from 'vitest';
import { buildWorkItems, parseQuantity } from '../src';

const q = (t: string, decimal: 'auto' | 'point' | 'comma') => parseQuantity(t, { defaultUnit: 'hours', decimal });

describe('number style chosen by the person', () => {
  it('decimal comma: 8,5 is 8.5 and 1.234,5 is 1234.5 and 1.234 is 1234 (dot = thousands)', () => {
    expect(q('8,5', 'comma').value).toBe(8.5);
    expect(q('1.234,5', 'comma').value).toBe(1234.5);
    expect(q('1.234', 'comma').value).toBe(1234);
    expect(q('12', 'comma').value).toBe(12);
    expect(q('-0,25', 'comma').value).toBe(-0.25);
  });
  it('decimal comma refuses what it cannot read (1.5 would be a point decimal)', () => {
    expect(q('1.5', 'comma').value).toBeNull();
    expect(q('1.5', 'comma').issues[0]?.code).toBe('unparseable');
    expect(q('1,2,3', 'comma').value).toBeNull();
  });
  it('decimal point: 1,234.5 is 1234.5 and 1,234 is 1234; 8,5 is refused', () => {
    expect(q('1,234.5', 'point').value).toBe(1234.5);
    expect(q('1,234', 'point').value).toBe(1234);
    expect(q('3.5', 'point').value).toBe(3.5);
    expect(q('8,5', 'point').value).toBeNull();
  });
  it('auto keeps refusing the ambiguous 8,5 (unchanged behaviour)', () => {
    expect(q('8,5', 'auto').issues[0]?.code).toBe('ambiguous_decimal');
    expect(q('8.5', 'auto').value).toBe(8.5);
  });
  it('units still work with the chosen style', () => {
    const r = parseQuantity('2,5 days', { decimal: 'comma' });
    expect(r.value).toBe(2.5);
    expect(r.unit).toBe('days');
  });
  it('reaches the import: estimates and percent complete are read in the chosen style', () => {
    const headers = ['Task', 'Status', 'Estimate (h)', 'Actual (h)', '% complete'];
    const rows = [['A', 'Done', '1.234,5', '10,25', '50,5%']];
    const mapping = { id: null, name: 'Task', status: 'Status', planned: 'Estimate (h)', actual: 'Actual (h)', percent: '% complete', start: null, finish: null };
    const items = buildWorkItems(headers, rows, mapping, { defaultUnit: 'hours', percentScale: '0-100', statusMap: {}, decimal: 'comma' });
    expect(items[0]?.estimate.value).toBe(1234.5);
    expect(items[0]?.actual.value).toBe(10.25);
    expect(items[0]?.percentCompleteReported).toBe(50.5);
  });
});
