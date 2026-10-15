import { describe, expect, it } from 'vitest';
import { roundHalfUp } from '../src/format';

describe('roundHalfUp', () => {
  it('rounds exact halves up, the way a spreadsheet shows them', () => {
    expect(roundHalfUp(0.725, 2)).toBe(0.73);
    expect(roundHalfUp(0.90625, 2)).toBe(0.91);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
  });

  it('rounds negatives away from zero', () => {
    expect(roundHalfUp(-0.725, 2)).toBe(-0.73);
  });

  it('supports zero decimals and leaves non-finite values alone', () => {
    expect(roundHalfUp(2.5, 0)).toBe(3);
    expect(roundHalfUp(Number.NaN, 2)).toBeNaN();
  });

  it('rejects an invalid number of decimals', () => {
    expect(() => roundHalfUp(1, -1)).toThrow(RangeError);
    expect(() => roundHalfUp(1, 1.5)).toThrow(RangeError);
  });
});
