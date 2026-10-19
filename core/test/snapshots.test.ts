import { describe, expect, it } from 'vitest';
import {
  addSnapshot, compareSnapshots, cpiOf, daysSinceUpdate, seriesOf, snapshotId, snapshotLabels, spiOf, toggleBaseline, trendPoints,
  validateSnapshot, type Snapshot,
} from '../src';

const mk = (over: Partial<Snapshot> = {}): Snapshot => ({
  format: 'openpm-lens-snapshot', version: 1, savedAt: '2026-03-17T10:00:00Z', label: 'Website', statusDate: '2026-03-17', source: 'a.xlsx', baseline: false,
  ev: 200, ac: 250, bac: 600, pv: 300, evSchedule: 180, costTasks: 8, scheduleTasks: 8,
  counts: { total: 12, notStarted: 6, inProgress: 3, done: 3, cancelled: 0 }, openDefects: 2,
  raid: { risksHigh: 1, risksMedium: 2, risksLow: 1, risksUnscored: 0, openIssues: 3, approvedHours: 20, approvedDays: 2 }, ...over,
});
const A = mk();
const B = mk({
  statusDate: '2026-03-31', savedAt: '2026-03-31T10:00:00Z', ev: 310, ac: 385, bac: 594, pv: 374, evSchedule: 310,
  counts: { total: 12, notStarted: 3, inProgress: 3, done: 6, cancelled: 1 }, openDefects: 1,
  raid: { risksHigh: 1, risksMedium: 2, risksLow: 1, risksUnscored: 1, openIssues: 3, approvedHours: 38, approvedDays: 5 },
});

describe('snapshot numbers (hand-worked)', () => {
  it('CPI and SPI: 200/250 = 0.8, 180/300 = 0.6, 310/385, 310/374', () => {
    expect(cpiOf(A)).toBeCloseTo(0.8, 6);
    expect(spiOf(A)).toBeCloseTo(0.6, 6);
    expect(cpiOf(B)).toBeCloseTo(0.805195, 5);
    expect(spiOf(B)).toBeCloseTo(0.828877, 5);
  });
  it('an index is null when a part is missing or the divisor is 0 (never 0 or infinity)', () => {
    expect(cpiOf(mk({ ac: 0 }))).toBeNull();
    expect(cpiOf(mk({ ev: null }))).toBeNull();
    expect(spiOf(mk({ pv: null }))).toBeNull();
  });
  it('trend: remaining = scope - earned (400, 284); throughput = 3 tasks in 14 days = 1.5 per week', () => {
    const t = trendPoints([A, B]);
    expect(t.map((p) => p.remaining)).toEqual([400, 284]);
    expect(t[0]!.throughputPerWeek).toBeNull();
    expect(t[1]!.throughputPerWeek).toBeCloseTo(1.5, 6);
    expect(t[1]!.openRisks).toBe(5);
    expect(t[0]!.openRisks).toBe(4);
  });
  it('throughput is null if the done count fell or the dates are the same', () => {
    expect(trendPoints([B, mk({ statusDate: '2026-04-07', counts: { total: 12, notStarted: 3, inProgress: 3, done: 4, cancelled: 0 } })])[1]!.throughputPerWeek).toBeNull();
    expect(trendPoints([A, mk({ statusDate: '2026-03-17' })])[1]!.throughputPerWeek).toBeNull();
  });
  it('compare: budget -6 h, earned +110 h, 14 days apart; missing stays null', () => {
    const c = compareSnapshots(A, B);
    expect(c.days).toBe(14);
    const r = Object.fromEntries(c.rows.map((x) => [x.key, x]));
    expect(r['bac']!.change).toBe(-6);
    expect(r['ev']!.change).toBe(110);
    expect(r['done']!.change).toBe(3);
    expect(r['total']!.b).toBe(11);
    expect(r['changes']!.change).toBe(18);
    const none = compareSnapshots(mk({ raid: null }), B);
    expect(none.rows.find((x) => x.key === 'issues')!.change).toBeNull();
  });
  it('days since the last update', () => {
    expect(daysSinceUpdate([A, B], '2026-04-04')).toBe(4);
    expect(daysSinceUpdate([], '2026-04-04')).toBeNull();
    expect(daysSinceUpdate([B], '2026-03-01')).toBeNull();
  });
});

describe('keeping snapshots', () => {
  it('the same label and status date replaces the older one', () => {
    const r1 = addSnapshot([A], mk({ ev: 210 }));
    expect(r1.replaced).toBe(true);
    expect(r1.list.length).toBe(1);
    expect(r1.list[0]!.ev).toBe(210);
    expect(addSnapshot([A], B).replaced).toBe(false);
  });
  it('only one baseline per label; other labels are untouched', () => {
    const other = mk({ label: 'App', baseline: true });
    let l = [A, B, other];
    l = toggleBaseline(l, snapshotId(A));
    expect(l.filter((x) => x.baseline).map((x) => x.label).sort()).toEqual(['App', 'Website']);
    l = toggleBaseline(l, snapshotId(B));
    expect(l.find((x) => x.statusDate === '2026-03-17' && x.label === 'Website')!.baseline).toBe(false);
    expect(l.find((x) => x.statusDate === '2026-03-31')!.baseline).toBe(true);
    expect(l.find((x) => x.label === 'App')!.baseline).toBe(true);
    expect(toggleBaseline(l, snapshotId(B)).find((x) => x.statusDate === '2026-03-31')!.baseline).toBe(false);
  });
  it('series are ordered by status date; labels are unique and sorted', () => {
    const l = [B, A, mk({ label: 'App' })];
    expect(seriesOf(l, 'Website').map((s) => s.statusDate)).toEqual(['2026-03-17', '2026-03-31']);
    expect(snapshotLabels(l)).toEqual(['App', 'Website']);
  });
});

describe('reading a snapshot file (never trusted)', () => {
  it('accepts a good snapshot, drops unknown fields, and survives a JSON round trip', () => {
    const r = validateSnapshot(JSON.parse(JSON.stringify({ ...A, extra: 'x' })));
    expect(r.problem).toBeNull();
    expect(r.snapshot).toEqual(A);
  });
  it.each([
    ['not an object', 5],
    ['wrong format', { ...A, format: 'other' }],
    ['wrong version', { ...A, version: 2 }],
    ['blank label', { ...A, label: ' ' }],
    ['bad date', { ...A, statusDate: '2026-02-30' }],
    ['text instead of a number', { ...A, ev: '200' }],
    ['not a finite number', { ...A, ac: Infinity }],
    ['negative count', { ...A, counts: { ...A.counts, done: -1 } }],
    ['fractional count', { ...A, costTasks: 1.5 }],
    ['bad risk value', { ...A, raid: { ...A.raid, openIssues: 'many' } }],
  ])('refuses %s', (_n, x) => {
    const r = validateSnapshot(x);
    expect(r.snapshot).toBeNull();
    expect(r.problem).not.toBeNull();
  });
  it('a missing risk block is allowed (null)', () => {
    expect(validateSnapshot({ ...A, raid: null }).snapshot!.raid).toBeNull();
  });
});
