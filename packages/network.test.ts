import { describe, expect, it } from 'vitest';
import { analyseNetwork, countedDayDate, parseDependsOn } from '../src';

const t = (id: string, duration: number, ...preds: string[]) => ({ id, duration, preds });
const row = (r: ReturnType<typeof analyseNetwork>, id: string) => r.rows.find((x) => x.id === id)!;

describe('critical path (worked example from a published teaching source)', () => {
  // A(5) -> B(10) -> D(5) is 20 days; A -> C(2) -> D is 12 days. C has 8 days of float.
  const r = analyseNetwork([t('A', 5), t('B', 10, 'A'), t('C', 2, 'A'), t('D', 5, 'B', 'C')]);
  it('project length is the longest path', () => expect(r.duration).toBe(20));
  it('forward pass: D starts at the larger of its predecessors\' finishes', () => {
    expect([row(r, 'B').es, row(r, 'B').ef]).toEqual([5, 15]);
    expect([row(r, 'C').es, row(r, 'C').ef]).toEqual([5, 7]);
    expect([row(r, 'D').es, row(r, 'D').ef]).toEqual([15, 20]);
  });
  it('backward pass: C may finish as late as D must start', () => {
    expect([row(r, 'C').ls, row(r, 'C').lf]).toEqual([13, 15]);
  });
  it('total float of C is 8 both ways, and free float is 8', () => {
    expect(row(r, 'C').totalFloat).toBe(8);
    expect(row(r, 'C').lf - row(r, 'C').ef).toBe(8);
    expect(row(r, 'C').freeFloat).toBe(8);
  });
  it('A, B, D are critical; C is not', () => {
    expect(r.rows.filter((x) => x.critical).map((x) => x.id).sort()).toEqual(['A', 'B', 'D']);
    expect(row(r, 'C').critical).toBe(false);
  });
});

describe('network edge cases', () => {
  it('two equal paths are both critical', () => {
    const r = analyseNetwork([t('S', 1), t('X', 4, 'S'), t('Y', 4, 'S'), t('E', 2, 'X', 'Y')]);
    expect(r.rows.filter((x) => x.critical).map((x) => x.id).sort()).toEqual(['E', 'S', 'X', 'Y']);
    expect(r.duration).toBe(7);
  });
  it('a milestone (duration 0) takes the finish of what it follows', () => {
    const r = analyseNetwork([t('A', 3), t('M', 0, 'A')]);
    expect([row(r, 'M').es, row(r, 'M').ef, row(r, 'M').totalFloat]).toEqual([3, 3, 0]);
  });
  it('a task with no links floats up to the project length', () => {
    const r = analyseNetwork([t('A', 10), t('Free', 2)]);
    expect(row(r, 'Free').totalFloat).toBe(8);
    expect(row(r, 'Free').freeFloat).toBe(8);
  });
  it('free float is smaller than total float when a successor is also fed by a longer path', () => {
    // A(2) -> C(2); B(6) -> C. A can slip 4 before it delays C, and C is on the long path.
    const r = analyseNetwork([t('A', 2), t('B', 6), t('C', 2, 'A', 'B')]);
    expect(row(r, 'A').totalFloat).toBe(4);
    expect(row(r, 'A').freeFloat).toBe(4);
    const r2 = analyseNetwork([t('A', 2), t('B', 6), t('C', 2, 'A', 'B'), t('D', 1, 'A')]);
    expect(row(r2, 'A').totalFloat).toBe(4); // via C
    expect(row(r2, 'A').freeFloat).toBe(0 + 0); // D can start right after A (ES 2) so A has no free float
    expect(row(r2, 'D').totalFloat).toBe(5); // D finishes day 3 of an 8-day project
  });
  it('reports unknown predecessors and self links, and ignores them', () => {
    const r = analyseNetwork([t('A', 2, 'ghost', 'A'), t('B', 3, 'A')]);
    expect(r.failed).toBe(false);
    expect(r.problems.map((p) => p.code).sort()).toEqual(['self_dependency', 'unknown_predecessor']);
    expect(r.duration).toBe(5);
  });
  it('refuses a loop instead of guessing', () => {
    const r = analyseNetwork([t('A', 1, 'C'), t('B', 1, 'A'), t('C', 1, 'B'), t('Z', 1)]);
    expect(r.failed).toBe(true);
    expect(r.rows).toEqual([]);
    expect(r.problems[0]!.code).toBe('cycle');
    expect(r.problems[0]!.ids.sort()).toEqual(['A', 'B', 'C']);
  });
  it('duplicate ids and bad durations are reported', () => {
    const r = analyseNetwork([t('A', 2), t('A', 9), t('B', Number.NaN), t('C', -1)]);
    expect(r.problems.map((p) => p.code).sort()).toEqual(['bad_duration', 'duplicate_id']);
    expect(r.rows.map((x) => x.id)).toEqual(['A']);
    expect(r.duration).toBe(2);
  });
  it('an empty network is length 0', () => {
    const r = analyseNetwork([]);
    expect([r.duration, r.rows.length, r.failed]).toEqual([0, 0, false]);
  });
});

describe('Depends on cells', () => {
  it('reads ids separated by commas or semicolons, including hyphens', () => {
    expect(parseDependsOn('W-1, W-2; W-3').ids).toEqual(['W-1', 'W-2', 'W-3']);
    expect(parseDependsOn('  ').ids).toEqual([]);
    expect(parseDependsOn(null).ids).toEqual([]);
    expect(parseDependsOn('3,3').ids).toEqual(['3']);
  });
  it('reports lag, lead and other link types instead of using them', () => {
    const r = parseDependsOn('4, 5SS, 6+2d, 7 FS, A: 2d');
    expect(r.ids).toEqual(['4']);
    expect(r.unsupported).toEqual(['5SS', '6+2d', '7 FS', 'A: 2d']);
  });
});

describe('counted-day dates', () => {
  it('weekdays: day 0 from a Friday is that Friday and day 1 is the next Monday', () => {
    expect(countedDayDate('2026-03-27', 0, 'weekdays')).toBe('2026-03-27');
    expect(countedDayDate('2026-03-27', 1, 'weekdays')).toBe('2026-03-30');
  });
  it('a start on a weekend begins on the next Monday', () => {
    expect(countedDayDate('2026-03-28', 0, 'weekdays')).toBe('2026-03-30');
  });
  it('holidays are skipped', () => {
    expect(countedDayDate('2026-03-24', 1, { mode: 'weekdays', holidays: ['2026-03-25'] })).toBe('2026-03-26');
  });
  it('calendar days count every day', () => {
    expect(countedDayDate('2026-03-27', 3, 'calendar')).toBe('2026-03-30');
  });
});
