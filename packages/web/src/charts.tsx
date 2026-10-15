import type { CyclePoint, ThroughputBlock } from '@openpm-lens/core';

/* Charts are plain SVG. Colours come from CSS classes (see styles.css), never inline styles (the CSP forbids them). */
const W = 640, H = 280, L = 48, R = 16, T = 16, B = 40;
const PW = W - L - R, PH = H - T - B;

function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const compact = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));
const ticks = (max: number) => [0, 0.25, 0.5, 0.75, 1].map((f) => +(max * f).toFixed(2));

function Frame({ title, desc, yLabel, xLabel, max, children }: { title: string; desc: string; yLabel: string; xLabel: string; max: number; children: React.ReactNode }) {
  return (
    <svg className="viz-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${desc}`}>
      <title>{title}</title>
      {ticks(max).map((t) => {
        const y = T + PH - (t / max) * PH;
        return (
          <g key={t}>
            <line className={t === 0 ? 'viz-axis' : 'viz-grid'} x1={L} x2={W - R} y1={y} y2={y} />
            <text className="viz-tick" x={L - 6} y={y + 4} textAnchor="end">{compact(t)}</text>
          </g>
        );
      })}
      <text className="viz-label" x={L} y={12}>{yLabel}</text>
      <text className="viz-label" x={W - R} y={H - 4} textAnchor="end">{xLabel}</text>
      {children}
    </svg>
  );
}

export function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>Show as table</summary>
      <div className="scroll">
        <table>
          <caption>{caption}</caption>
          <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

/** Planned value over time, with the earned value at the status date. */
export function EarnedValueChart({ dates, pv, statusDate, ev }: { dates: string[]; pv: number[]; statusDate: string; ev: number | null }) {
  if (dates.length < 2) return null;
  const max = niceMax(Math.max(...pv, ev ?? 0));
  const x = (i: number) => L + (i / (dates.length - 1)) * PW;
  const y = (v: number) => T + PH - (v / max) * PH;
  const path = pv.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // status date position: last counted day on or before it
  let si = -1;
  dates.forEach((d, i) => { if (d <= statusDate) si = i; });
  const showEv = ev !== null && si >= 0;
  const pvAtStatus = si >= 0 ? (pv[si] ?? null) : null;
  const hours = (n: number) => `${+n.toFixed(2)} h`;
  return (
    <figure className="viz-root">
      <figcaption><strong>Planned value and earned value (hours)</strong></figcaption>
      <div className="viz-legend" aria-hidden="true">
        <span><i className="sw sw-1" /> Planned value (plan)</span>
        {showEv && <span><i className="sw sw-2" /> Earned value at status date</span>}
      </div>
      <Frame title="Planned value and earned value" desc={`Planned value rises to ${hours(pv[pv.length - 1] ?? 0)} by ${dates[dates.length - 1] ?? ''}.${showEv ? ` Earned value at ${statusDate} is ${hours(ev as number)}.` : ''}`} yLabel="Hours" xLabel="Date" max={max}>
        <text className="viz-tick" x={L} y={H - 22} textAnchor="start">{dates[0] ?? ''}</text>
        <text className="viz-tick" x={W - R} y={H - 22} textAnchor="end">{dates[dates.length - 1] ?? ''}</text>
        <path className="viz-line s1" d={path} />
        {si >= 0 && <line className="viz-ref" x1={x(si)} x2={x(si)} y1={T} y2={T + PH} />}
        {si >= 0 && <text className="viz-tick" x={Math.min(Math.max(x(si), L + 30), W - R - 30)} y={H - 8} textAnchor="middle">Status {statusDate}</text>}
        {showEv && (
          <g>
            <circle className="viz-dot s2" cx={x(si)} cy={y(ev as number)} r={5}><title>{`Earned value ${hours(ev as number)} at ${statusDate}`}</title></circle>
            <text className="viz-label" x={x(si) + 10} y={y(ev as number) - 8}>EV {hours(ev as number)}</text>
          </g>
        )}
        {pvAtStatus !== null && (
          <circle className="viz-dot s1" cx={x(si)} cy={y(pvAtStatus)} r={4}><title>{`Planned value ${hours(pvAtStatus)} at ${statusDate}`}</title></circle>
        )}
      </Frame>
      <ChartTable caption="Planned value by day (hours)" head={['Date', 'Planned value (h)']} rows={dates.map((d, i) => [d, +(pv[i] ?? 0).toFixed(2)])} />
    </figure>
  );
}

/** Items finished in each block of 7 days. */
export function ThroughputChart({ blocks }: { blocks: ThroughputBlock[] }) {
  if (blocks.length === 0) return null;
  const max = niceMax(Math.max(...blocks.map((b) => b.count), 1));
  const slot = PW / blocks.length;
  const bw = Math.min(24, slot * 0.6);
  const y = (v: number) => T + PH - (v / max) * PH;
  const labelEvery = Math.ceil(blocks.length / 8);
  return (
    <figure className="viz-root">
      <figcaption><strong>Items finished in each block of 7 days</strong></figcaption>
      <Frame title="Throughput" desc={`${blocks.reduce((a, b) => a + b.count, 0)} items finished across ${blocks.length} blocks of 7 days.`} yLabel="Items" xLabel="Block ends on" max={max}>
        {blocks.map((b, i) => {
          const cx = L + slot * (i + 0.5);
          const top = y(b.count);
          const h = T + PH - top;
          const r = Math.min(4, bw / 2, h);
          const d = h <= 0 ? '' : `M${cx - bw / 2},${T + PH} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${T + PH} Z`;
          return (
            <g key={b.from}>
              {d && <path className="viz-bar s1" d={d}><title>{`${b.from} to ${b.to}: ${b.count} finished`}</title></path>}
              {b.count > 0 && <text className="viz-label" x={cx} y={top - 4} textAnchor="middle">{b.count}</text>}
              {i % labelEvery === 0 && <text className="viz-tick" x={cx} y={H - 22} textAnchor="middle">{b.to.slice(5)}</text>}
            </g>
          );
        })}
      </Frame>
      <ChartTable caption="Items finished per block of 7 days" head={['From', 'To', 'Items finished']} rows={blocks.map((b) => [b.from, b.to, b.count])} />
    </figure>
  );
}

/** Each finished item as a dot: when it finished (across) and how many days it took (up). */
export function CycleScatter({ points, p50, p85 }: { points: CyclePoint[]; p50: number | null; p85: number | null }) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.done.localeCompare(b.done));
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const first = sorted[0]?.done ?? '', last = sorted[sorted.length - 1]?.done ?? '';
  const t0 = t(first), t1 = t(last);
  const span = t1 - t0;
  const max = niceMax(Math.max(...points.map((p) => p.days), p85 ?? 0));
  const x = (d: string) => (span === 0 ? L + PW / 2 : L + ((t(d) - t0) / span) * (PW - 16) + 8);
  const y = (v: number) => T + PH - (v / max) * PH;
  return (
    <figure className="viz-root">
      <figcaption><strong>Cycle time of each finished item (days)</strong></figcaption>
      <Frame title="Cycle time scatter" desc={`${points.length} finished items. ${p50 === null ? '' : `50th percentile ${p50} days. `}${p85 === null ? '' : `85th percentile ${p85} days.`}`} yLabel="Days from start to done" xLabel="Date finished" max={max}>
        <text className="viz-tick" x={L} y={H - 22} textAnchor="start">{first}</text>
        <text className="viz-tick" x={W - R} y={H - 22} textAnchor="end">{last}</text>
        {p50 !== null && <g><line className="viz-ref" x1={L} x2={W - R} y1={y(p50)} y2={y(p50)} /><text className="viz-label" x={W - R - 4} y={y(p50) - 4} textAnchor="end">50th: {p50} days</text></g>}
        {p85 !== null && <g><line className="viz-ref" x1={L} x2={W - R} y1={y(p85)} y2={y(p85)} /><text className="viz-label" x={W - R - 4} y={y(p85) - 4} textAnchor="end">85th: {p85} days</text></g>}
        {sorted.map((p) => (
          <circle key={p.id} className="viz-dot s1" cx={x(p.done)} cy={y(p.days)} r={4}><title>{`${p.id} ${p.name !== p.id ? p.name : ''}: ${p.days} days, finished ${p.done}`}</title></circle>
        ))}
      </Frame>
      <ChartTable caption="Cycle time per finished item" head={['Item', 'Finished', 'Days']} rows={sorted.map((p) => [`${p.id} ${p.name !== p.id ? p.name : ''}`.trim(), p.done, p.days])} />
    </figure>
  );
}
