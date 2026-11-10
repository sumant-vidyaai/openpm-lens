import { describe, expect, it } from 'vitest';
import { analyseDefects, type DefectItem } from '../src/defects';

const D = (id: string, sev: string | null, created: string | null, resolved: string | null, x: Partial<DefectItem> = {}): DefectItem =>
  ({ id, name: id, isDefect: true, severity: sev, created, resolved, closedByStatus: false, cancelled: false, foundAfterRelease: null, issues: [], ...x });
const N = (id: string): DefectItem => D(id, null, null, null, { isDefect: false });

// Status date 2026-03-31. Hand-worked below.
const items: DefectItem[] = [
  D('d1', 'High', '2026-03-01', '2026-03-05'),   // closed, 5 days
  D('d2', 'High', '2026-03-02', '2026-03-04'),   // closed, 3
  D('d3', 'Low', '2026-03-03', '2026-03-13'),    // closed, 11
  D('d4', 'Medium', '2026-03-05', '2026-03-06'), // closed, 2
  D('d5', 'Low', '2026-03-10', '2026-03-30'),    // closed, 21
  D('d6', 'High', '2026-03-15', null),           // open, age 17
  D('d7', 'Medium', '2026-03-28', null),         // open, age 4
  D('d8', 'High', '2026-03-01', null, { cancelled: true }),
  D('d9', 'Medium', null, null),                 // open, no created date
  D('d10', 'Low', '2026-04-10', null),           // created after status date
  N('n1'), N('n2'), N('n3'), N('n4'), N('n5'), N('n6'),
  D('u1', null, null, null, { isDefect: null }),
];
const r = analyseDefects(items, '2026-03-31');

describe('analyseDefects (hand-checked)', () => {
  it('counts open, closed and share', () => {
    expect(r.defects).toBe(8);
    expect(r.closed).toBe(5);
    expect(r.open).toBe(3);
    expect(r.otherItems).toBe(6);
    expect(r.sharePercent).toBe(57); // 8 / 14
  });
  it('resolution time counts both days', () => {
    expect(r.resolution?.n).toBe(5);
    expect(r.resolution?.mean).toBeCloseTo(8.4); // 5+3+11+2+21 = 42
    expect(r.resolution?.median).toBe(5);        // sorted 2,3,5,11,21 ; rank 3
    expect(r.resolution?.p85).toBe(21);          // rank 5
  });
  it('open age, oldest first, missing created date kept apart', () => {
    expect(r.openList.map((o) => [o.id, o.age])).toEqual([['d6', 17], ['d7', 4], ['d9', null]]);
    expect(r.openAgeMean).toBeCloseTo(10.5);
    expect(r.openAgeMedian).toBeNull(); // only 2 ages
    expect(r.caveats.join(' ')).toContain('no created date');
  });
  it('severity mix', () => {
    expect(r.bySeverity).toEqual([
      { severity: 'High', total: 3, open: 1, closed: 2 },
      { severity: 'Medium', total: 3, open: 2, closed: 1 },
      { severity: 'Low', total: 2, open: 0, closed: 2 },
    ]);
  });
  it('lists what was left out', () => {
    expect(r.excluded.map((e) => e.id).sort()).toEqual(['d10', 'd8', 'u1']);
    expect(r.unknownType).toBe(1);
  });
  it('every item is accounted for exactly once', () => {
    expect(r.defects + r.otherItems + r.excluded.length).toBe(items.length);
  });
  it('withholds the share under the minimum', () => {
    const x = analyseDefects([D('a', null, '2026-03-01', null), N('b')], '2026-03-31');
    expect(x.sharePercent).toBeNull();
    expect(x.caveats.join(' ')).toContain('Insufficient data');
  });
  it('a done status with no resolved date counts as closed, without a resolution time', () => {
    const x = analyseDefects([D('a', null, '2026-03-01', null, { closedByStatus: true })], '2026-03-31');
    expect(x.closed).toBe(1);
    expect(x.resolution).toBeNull();
  });
  it('a resolved date after the status date is still open', () => {
    const x = analyseDefects([D('a', null, '2026-03-01', '2026-04-05')], '2026-03-31');
    expect(x.open).toBe(1);
  });
  it('unclear dates are left out', () => {
    const x = analyseDefects([D('a', null, '2026-03-01', null, { issues: [{ code: 'ambiguous_date', field: 'createdAt', message: 'x' }] })], '2026-03-31');
    expect(x.defects).toBe(0);
    expect(x.excluded[0]?.reason).toContain('unclear');
  });
});

describe('removal efficiency (optional)', () => {
  const f = (id: string, after: boolean | null) => D(id, null, '2026-03-01', '2026-03-05', { foundAfterRelease: after });
  it('before / known total, shown only with enough defects', () => {
    const x = analyseDefects([f('a', false), f('b', false), f('c', false), f('d', false), f('e', false), f('g', true), f('h', null)], '2026-03-31', true);
    expect(x.removal).toMatchObject({ before: 5, after: 1, unknown: 1, percent: 83 }); // 5 / 6
  });
  it('is insufficient with fewer than 5 known', () => {
    const x = analyseDefects([f('a', false), f('b', true)], '2026-03-31', true);
    expect(x.removal?.percent).toBeNull();
  });
  it('is absent when not asked for', () => {
    expect(analyseDefects([f('a', false)], '2026-03-31').removal).toBeNull();
  });
});
