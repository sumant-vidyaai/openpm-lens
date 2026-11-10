import { describe, expect, it } from 'vitest';
import {
  buildZip, goCheckConsistency, loadArchive, makeArchive, parseGoChecklist, readZip, solicitationsByType, summariseGoCheck, weightSensitivity,
  extractLifecycleSheets, isTemplateTable,
} from '../src';
import { archiveSections } from '../../web/src/archiveSections';

describe('weightSensitivity', () => {
  // Weights: Price 2, Fit 1.  A: Price 8, Fit 4 -> (16+4)/3 = 6.667.  B: Price 5, Fit 9 -> (10+9)/3 = 6.333.  A leads.
  const crit = [{ name: 'Price', weight: 2 }, { name: 'Fit', weight: 1 }];
  const opts = [{ option: 'A', scores: { Price: 8, Fit: 4 } }, { option: 'B', scores: { Price: 5, Fit: 9 } }];
  const s = weightSensitivity(crit, opts);
  it('finds the leader', () => { expect(s.leader).toBe('A'); });
  it('Price: A and B tie where 8w + 4 = 5w + 9 -> w = 5/3 (lower than 2, so about -16.7%)', () => {
    const p = s.rows.find((r) => r.criterion === 'Price');
    expect(p?.lower?.weight).toBeCloseTo(5 / 3, 9);
    expect(p?.lower?.percent).toBeCloseTo(((5 / 3 - 2) / 2) * 100, 9);
    expect(p?.lower?.challenger).toBe('B');
    expect(p?.higher).toBeNull();
  });
  it('Fit: tie where 16 + 4w = 10 + 9w -> w = 1.2 (higher than 1, +20%)', () => {
    const f = s.rows.find((r) => r.criterion === 'Fit');
    expect(f?.higher?.weight).toBeCloseTo(1.2, 9);
    expect(f?.higher?.percent).toBeCloseTo(20, 9);
    expect(f?.lower).toBeNull();
  });
  it('the flip is real: at the tie weight the scores are equal, just beyond it the challenger leads', () => {
    const at = weightSensitivity([{ name: 'Price', weight: 5 / 3 }, { name: 'Fit', weight: 1 }], opts);
    expect(at.tiedAtTop.sort()).toEqual(['A', 'B']);
    const past = weightSensitivity([{ name: 'Price', weight: 1.6 }, { name: 'Fit', weight: 1 }], opts);
    expect(past.leader).toBe('B');
  });
  it('a clear winner that wins on every criterion holds for any weight', () => {
    const x = weightSensitivity(crit, [{ option: 'A', scores: { Price: 9, Fit: 9 } }, { option: 'B', scores: { Price: 5, Fit: 5 } }]);
    expect(x.holdsForAnyWeight).toBe(true);
  });
  it('reports a tie at the top and options with missing scores', () => {
    const t = weightSensitivity(crit, [{ option: 'A', scores: { Price: 5, Fit: 5 } }, { option: 'B', scores: { Price: 5, Fit: 5 } }, { option: 'C', scores: { Price: 1, Fit: null } }]);
    expect(t.leader).toBeNull(); expect(t.tiedAtTop.sort()).toEqual(['A', 'B']); expect(t.leftOut).toEqual(['C']);
  });
});

describe('go checklist', () => {
  const g = parseGoChecklist([['Criterion', 'Owner', 'Met', 'Note'], ['Business case approved', 'Asha', 'Yes', ''], ['Budget secured', 'Ravi', 'No', 'waiting'], ['Team named', '', '', ''], ['Legal review', '', 'Not applicable', ''], ['Odd', '', 'maybe', ''], ['', 'x', 'Yes', '']]);
  it('reads answers and flags odd ones', () => {
    expect(g.items.map((i) => i.answer)).toEqual(['yes', 'no', null, 'na', null]);
    expect(g.problems.join(' ')).toMatch(/maybe/);
    expect(g.problems.join(' ')).toMatch(/no criterion/);
  });
  const sm = summariseGoCheck(g.items);
  it('counts', () => { expect(sm).toEqual({ total: 5, met: 1, notMet: 1, notAnswered: 2, notApplicable: 1 }); });
  it('a Go with unmet or unanswered items is flagged; a clean Go is not', () => {
    expect(goCheckConsistency('go', sm)).toHaveLength(2);
    expect(goCheckConsistency('go', { total: 3, met: 2, notMet: 0, notAnswered: 0, notApplicable: 1 })).toEqual([]);
  });
  it('a No go with everything met is questioned; with a gap it is not', () => {
    expect(goCheckConsistency('no_go', { total: 2, met: 2, notMet: 0, notAnswered: 0, notApplicable: 0 })).toHaveLength(1);
    expect(goCheckConsistency('no_go', sm)).toEqual([]);
    expect(goCheckConsistency(null, sm)).toEqual([]);
  });
});

describe('RFQ in the tracker', () => {
  it('counts by type, upper-cased, blank listed', () => {
    const rows = [
      { id: '1', kind: 'RFQ', vendor: 'a', due: null, received: '2026-01-01', status: null }, { id: '2', kind: 'rfq', vendor: 'b', due: null, received: null, status: null },
      { id: '3', kind: 'RFP', vendor: 'c', due: null, received: null, status: null }, { id: '4', kind: '', vendor: 'd', due: null, received: null, status: null },
    ];
    expect(solicitationsByType(rows)).toEqual([{ type: '(no type)', total: 1, received: 0 }, { type: 'RFP', total: 1, received: 0 }, { type: 'RFQ', total: 2, received: 1 }]);
  });
});

describe('zip reader and archive round trip', () => {
  const when = new Date('2026-03-31T10:00:00Z');
  it('reads back what buildZip wrote', async () => {
    const z = await readZip(buildZip([{ name: 'a.txt', data: 'héllo' }, { name: 'b/c.csv', data: 'x,y\n1,2' }], when));
    expect(z.map((e) => e.name)).toEqual(['a.txt', 'b/c.csv']);
    expect(new TextDecoder().decode(z[0]?.data)).toBe('héllo');
  });
  it('refuses a non-zip', async () => { await expect(readZip(new Uint8Array([1, 2, 3]))).rejects.toThrow(/not a zip/); });
  it('reads a deflate-compressed zip (as made by other tools)', async () => {
    const { deflateRawSync, crc32 } = await import('node:zlib') as unknown as { deflateRawSync: (b: Buffer) => Buffer; crc32?: (b: Buffer) => number };
    const data = Buffer.from('hello hello hello hello');
    const comp = deflateRawSync(data);
    const name = Buffer.from('f.txt');
    const crc = crc32 ? crc32(data) : 0;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(0, 42);
    const body = Buffer.concat([lh, name, comp]);
    const dir = Buffer.concat([cd, name]);
    const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(body.length, 16);
    const z = await readZip(new Uint8Array(Buffer.concat([body, dir, eocd])));
    expect(new TextDecoder().decode(z[0]?.data)).toBe('hello hello hello hello');
  });
  const tasks = { headers: ['Task', 'Estimate (h)'], rows: [['A', '10']] };
  it('an archive made by the app loads back with the same sheets', async () => {
    const life = extractLifecycleSheets([
      { name: 'Risks', data: [['ID', 'Risk', 'Probability (1-5)', 'Impact (1-5)', 'Owner', 'Response', 'Status', 'Action', 'Action due', 'Action done'], ['R1', 'Late, very', 4, 3, 'Asha', 'Mitigate', 'Open', 'Call', '2026-03-20', '']] },
      { name: 'Scoring', data: [['Option', 'Price', 'Fit'], ['Weight', 2, 1], ['A', 8, 4], ['B', 5, '']] },
      { name: 'Go-no-go', data: [['Decision', 'Decided by', 'Date', 'Reason'], ['No go', 'Sponsor', '2026-03-01', 'Too costly']] },
      { name: 'RFI-RFP', data: [['ID', 'Type', 'Vendor', 'Due', 'Received', 'Status'], ['S1', 'RFQ', 'Acme', '2026-03-10', '', 'Sent']] },
      { name: 'Gate checklist', data: [['Criterion', 'Owner', 'Met', 'Note'], ['Budget', 'Ravi', 'No', 'waiting']] },
    ]);
    const bytes = makeArchive({ fileName: 'x.csv', statusDate: '2026-03-31', exportedAt: when, version: '1.5.0', tasks, sections: archiveSections({ raid: life, initiate: life, close: life }), snapshotsJson: null });
    const back = await loadArchive(bytes, isTemplateTable);
    expect(back.statusDate).toBe('2026-03-31');
    expect(back.tasksAreGeneric).toBe(true);
    expect(back.sheets[0]?.name).toBe('Archived tasks');
    const l2 = extractLifecycleSheets(back.sheets);
    expect(l2.risks.risks).toEqual(life.risks.risks);
    expect(l2.scoring.criteria).toEqual(life.scoring.criteria);
    expect(l2.scoring.options).toEqual(life.scoring.options);
    expect(l2.goRecord.record).toEqual(life.goRecord.record);
    expect(l2.solicitations.rows).toEqual(life.solicitations.rows);
    expect(l2.gateChecklist.items).toEqual(life.gateChecklist.items);
    expect(back.problems).toEqual([]);
  });
  it('refuses a zip that is not a Spashta archive', async () => {
    await expect(loadArchive(buildZip([{ name: 'a.txt', data: 'hi' }], when), isTemplateTable)).rejects.toThrow(/not a Spashta archive/);
  });
});
