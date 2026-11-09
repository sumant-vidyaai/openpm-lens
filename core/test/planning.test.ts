import { describe, expect, it } from 'vitest';
import { analyseThreePoint, pertEstimate, reserveCheck, reserveStack } from '../src';

describe('PERT (worked example from a published guide)', () => {
  it('O 4, M 7, P 10 gives expected 7 and standard deviation 1', () => {
    expect(pertEstimate(4, 7, 10)).toEqual({ expected: 7, sd: 1, variance: 1 });
  });
  it('weights the most likely value four times: O 2, M 4, P 12 gives (2 + 16 + 12) / 6 = 5 and SD 10/6', () => {
    const e = pertEstimate(2, 4, 12);
    expect(e.expected).toBe(5);
    expect(e.sd).toBeCloseTo(1.6667, 4);
  });
});

describe('three-point totals', () => {
  const r = analyseThreePoint([
    { id: 'a', optimistic: 4, mostLikely: 7, pessimistic: 10 },   // expected 7, sd 1
    { id: 'b', optimistic: 2, mostLikely: 4, pessimistic: 12 },   // expected 5, sd 10/6
    { id: 'c', optimistic: 5, mostLikely: 5, pessimistic: 5 },    // expected 5, sd 0
    { id: 'd', optimistic: null, mostLikely: 8, pessimistic: null },
    { id: 'e', optimistic: 9, mostLikely: 3, pessimistic: 6 },
    { id: 'f', optimistic: 1, mostLikely: null, pessimistic: 4 },
  ]);
  it('uses only tasks with three values in order, and says why the others are left out', () => {
    expect([r.used, r.leftOut]).toEqual([3, 3]);
    expect(r.rows.find((x) => x.id === 'd')!.note).toMatch(/no optimistic or pessimistic/);
    expect(r.rows.find((x) => x.id === 'e')!.note).toMatch(/not in order/);
    expect(r.rows.find((x) => x.id === 'f')!.note).toMatch(/missing/);
  });
  it('sums most likely and expected over the used tasks (7+4+5 = 16 and 7+5+5 = 17)', () => {
    expect(r.sumMostLikely).toBe(16);
    expect(r.sumExpected).toBe(17);
  });
  it('total SD is the square root of the summed variances: sqrt(1 + 100/36 + 0)', () => {
    expect(r.sd).toBeCloseTo(Math.sqrt(1 + 100 / 36), 10);
    expect(r.range1![0]).toBeCloseTo(17 - r.sd!, 10);
    expect(r.range2![1]).toBeCloseTo(17 + 2 * r.sd!, 10);
  });
  it('nothing usable gives nulls, not zeros', () => {
    const e = analyseThreePoint([{ id: 'x', optimistic: null, mostLikely: 3, pessimistic: null }]);
    expect([e.sumExpected, e.sumMostLikely, e.sd, e.range1]).toEqual([null, null, null, null]);
  });
});

describe('reserves (worked example from a published guide)', () => {
  const s = reserveStack(10_000_000, 600_000, 500_000);
  it('cost baseline 10,600,000 and project budget 11,100,000', () => {
    expect(s.costBaseline).toBe(10_600_000);
    expect(s.budget).toBe(11_100_000);
  });
  it('a missing contingency is not treated as 0', () => {
    const n = reserveStack(100, null, 50);
    expect([n.costBaseline, n.budget]).toEqual([null, null]);
    expect(reserveStack(100, 10, null).budget).toBeNull();
    expect(reserveStack(100, 10, null).costBaseline).toBe(110);
  });
  it('an overrun of 300,000 uses half the contingency', () => {
    const c = reserveCheck(s, 300_000);
    expect(c.state).toBe('within_contingency');
    expect(c.contingencyShare).toBeCloseTo(0.5, 10);
  });
  it('an overrun of 700,000 needs 100,000 from the management reserve', () => {
    const c = reserveCheck(s, 700_000);
    expect([c.state, c.fromManagement, c.beyondBudget]).toEqual(['needs_management', 100_000, 0]);
  });
  it('an overrun of 1,200,000 exceeds the budget by 100,000', () => {
    const c = reserveCheck(s, 1_200_000);
    expect([c.state, c.fromManagement, c.beyondBudget]).toEqual(['exceeds_budget', 500_000, 100_000]);
  });
  it('no overrun, or an unknown one, is stated as such', () => {
    expect(reserveCheck(s, -50).state).toBe('no_overrun');
    expect(reserveCheck(s, 0).state).toBe('no_overrun');
    expect(reserveCheck(s, null).state).toBe('unknown');
    expect(reserveCheck(reserveStack(100, null, null), 20).state).toBe('unknown');
  });
});
