import { describe, expect, it } from 'vitest';
import { buildZip, makeArchive } from '../src';

// reads a zip back with a tiny independent reader (stored entries only), so the test does not trust the writer's own code
function readZip(b: Uint8Array): Record<string, string> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Record<string, string> = {};
  let eocd = b.length - 22;
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < n; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
    out[name] = new TextDecoder().decode(b.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + size));
    p += 46 + nl;
  }
  return out;
}

describe('zip writer', () => {
  it('round-trips names and text, including non-English characters', () => {
    const z = readZip(buildZip([{ name: 'a.txt', data: 'hello' }, { name: 'b/ü.csv', data: 'x,y\n1,2\n₹5' }], new Date(2026, 10, 10, 12, 0, 0)));
    expect(z).toEqual({ 'a.txt': 'hello', 'b/ü.csv': 'x,y\n1,2\n₹5' });
  });
});

describe('archive', () => {
  const a = makeArchive({
    fileName: 'x.xlsx', statusDate: '2026-03-31', exportedAt: new Date(Date.UTC(2026, 10, 10, 6, 0, 0)), version: '1.3.1',
    tasks: { headers: ['ID', 'Task'], rows: [['W-1', 'Plan, with comma']] },
    sections: [{ file: 'benefits.csv', title: 'Benefits', rows: [['Benefit', 'Planned'], ['Faster', 100]] }],
    snapshotsJson: '[{"a":1}]',
  });
  const z = readZip(a);
  it('contains the tasks, each filled sheet, snapshots and a README that lists them', () => {
    expect(Object.keys(z)).toEqual(['tasks.csv', 'benefits.csv', 'snapshots.json', 'README.txt']);
    expect(z['tasks.csv']).toContain('"Plan, with comma"');
    expect(z['benefits.csv']).toContain('Faster,100');
    expect(z['README.txt']).toContain('benefits.csv - Benefits (1 rows)');
    expect(z['README.txt']).toContain('Status date: 2026-03-31');
  });
  it('leaves snapshots.json out when there are none', () => {
    const b = readZip(makeArchive({ fileName: '', statusDate: null, exportedAt: new Date(), version: '1', tasks: { headers: ['ID'], rows: [] }, sections: [], snapshotsJson: null }));
    expect(Object.keys(b)).toEqual(['tasks.csv', 'README.txt']);
    expect(b['README.txt']).toContain('Status date: not set');
  });
});
