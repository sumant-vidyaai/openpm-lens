import { describe, expect, it } from 'vitest';
import { analyseFlow, buildFlowItems, inclusiveDays, percentileNearestRank, suggestFlowColumns, type FlowItem } from '../src/flow';

const I = (id: string, start: string | null, done: string | null, extra: Partial<FlowItem> = {}): FlowItem =>
  ({ id, name: id, start, done, cancelled: false, markedDone: false, issues: [], ...extra });

// Status date 2026-01-28, 2 blocks of 7 days: 01-15..01-21 and 01-22..01-28. Hand-worked below.
const items: FlowItem[] = [
  I('A', '2026-01-05', '2026-01-09'), // finished before the window
  I('B', '2026-01-12', '2026-01-16'), // block 1, cycle 5
  I('C', '2026-01-14', '2026-01-20'), // block 1, cycle 7
  I('D', '2026-01-19', '2026-01-23'), // block 2, cycle 5
  I('E', '2026-01-20', '2026-01-27'), // block 2, cycle 8
  I('F', '2026-01-22', '2026-01-28'), // block 2, cycle 7
  I('G', '2026-01-10', null),         // WIP, age 19
  I('H', '2026-01-26', null),         // WIP, age 3
  I('I', '2026-01-10', null, { cancelled: true }),
  I('J', null, '2026-01-21'),         // block 1, no start
  I('K', '2026-01-10', null, { markedDone: true }),
  I('L', '2026-01-05', '2026-01-03'),
  I('M', '2026-02-02', null),
];
const r = analyseFlow(items, { statusDate: '2026-01-28', weeks: 2 });

describe('analyseFlow (hand-checked)', () => {
  it('window and throughput', () => {
    expect(r.windowStart).toBe('2026-01-15');
    expect(r.throughput.map((b) => b.count)).toEqual([3, 3]); // B,C,J and D,E,F
    expect(r.throughputTotal).toBe(6);
    expect(r.throughputPerWeek).toBe(3);
    expect(r.finishedBeforeWindow).toBe(1);
  });
  it('cycle time, counting both days', () => {
    expect(r.cycle?.values).toEqual([5, 5, 7, 7, 8]);
    expect(r.cycle?.mean).toBeCloseTo(6.4);
    expect(r.cycle?.p50).toBe(7);
    expect(r.cycle?.p85).toBe(8);
    expect(r.finishedNoStart).toBe(1);
  });
  it('WIP and aging, flagged against the 85th percentile', () => {
    expect(r.wip).toBe(2);
    expect(r.aging.map((a) => [a.id, a.age, a.olderThanP85])).toEqual([['G', 19, true], ['H', 3, false]]);
  });
  it('lists what was left out and why', () => {
    expect(r.excluded.map((e) => e.id).sort()).toEqual(['I', 'K', 'L', 'M']);
    expect(r.excluded.find((e) => e.id === 'K')?.reason).toContain('no done date');
    expect(r.excluded.find((e) => e.id === 'L')?.reason).toContain('before start');
  });
  it('every item is accounted for exactly once', () => {
    const counted = r.throughputTotal + r.finishedBeforeWindow + r.wip + r.excluded.length;
    expect(counted).toBe(items.length);
  });
  it('shows the working', () => {
    const text = r.steps.map((s) => s.steps.join(' ')).join(' ');
    expect(text).toContain('Sorted: 5, 5, 7, 7, 8');
    expect(text).toContain('85th percentile: rank 5 -> 8 days');
  });
});

describe('small samples and edge cases', () => {
  it('withholds percentiles below the minimum sample', () => {
    const x = analyseFlow([I('a', '2026-01-20', '2026-01-22'), I('b', '2026-01-20', '2026-01-24')], { statusDate: '2026-01-28', weeks: 2 });
    expect(x.cycle?.n).toBe(2);
    expect(x.cycle?.p85).toBeNull();
    expect(x.caveats.join(' ')).toContain('Insufficient data');
  });
  it('no cycle time without any start dates', () => {
    expect(analyseFlow([I('a', null, '2026-01-22')], { statusDate: '2026-01-28', weeks: 2 }).cycle).toBeNull();
  });
  it('an item finished after the status date is still in progress', () => {
    const x = analyseFlow([I('a', '2026-01-20', '2026-02-10')], { statusDate: '2026-01-28', weeks: 2 });
    expect(x.wip).toBe(1);
    expect(x.throughputTotal).toBe(0);
  });
  it('unclear dates are left out, not guessed', () => {
    const [it] = buildFlowItems(['Name', 'Started', 'Done'], [['x', '03/04/2026', '2026-04-10']], { id: null, name: 'Name', status: null, start: 'Started', done: 'Done' });
    expect(it?.start).toBeNull();
    const x = analyseFlow(it ? [it] : [], { statusDate: '2026-04-30', weeks: 4 });
    expect(x.excluded[0]?.reason).toContain('unclear');
  });
  it('a day-month-year choice reads those dates', () => {
    const [it] = buildFlowItems(['Name', 'Started', 'Done'], [['x', '03/04/2026', '10/04/2026']], { id: null, name: 'Name', status: null, start: 'Started', done: 'Done' }, 'dmy');
    expect(it?.start).toBe('2026-04-03');
    expect(it?.done).toBe('2026-04-10');
  });
  it('same-day start and finish is 1 day', () => expect(inclusiveDays('2026-01-05', '2026-01-05')).toBe(1));
  it('nearest-rank percentile', () => {
    expect(percentileNearestRank([1, 2, 3, 4], 50)).toBe(2);
    expect(percentileNearestRank([1, 2, 3, 4], 85)).toBe(4);
    expect(percentileNearestRank([], 85)).toBeNull();
  });
  it('status words mark done and cancelled', () => {
    const rows = buildFlowItems(['Name', 'Status', 'Started', 'Done'], [['a', 'Done', '2026-01-01', ''], ['b', 'Cancelled', '2026-01-01', ''], ['c', 'In Progress', '2026-01-01', '']], { id: null, name: 'Name', status: 'Status', start: 'Started', done: 'Done' });
    expect(rows.map((x) => [x.markedDone, x.cancelled])).toEqual([[true, false], [false, true], [false, false]]);
  });
  it('does not guess Created as a start date', () => {
    expect(suggestFlowColumns(['Summary', 'Created', 'Resolved']).start).toBeNull();
    expect(suggestFlowColumns(['Summary', 'Created', 'Resolved']).done).toBe('Resolved');
    expect(suggestFlowColumns(['Title', 'Started', 'Closed']).start).toBe('Started');
  });
});
