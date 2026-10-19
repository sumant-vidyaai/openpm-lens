import type { CyclePoint, ThroughputBlock } from '@openpm-lens/core';

/* Charts are plain SVG. Colours come from CSS classes (see styles.css), never inline styles (the CSP forbids them). */
export const W = 640, H = 280, L = 48, R = 16, T = 16, B = 40;
export const PW = W - L - R, PH = H - T - B;

export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const compact = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));
const ticks = (max: number) => [0, 0.25, 0.5, 0.75, 1].map((f) => +(max * f).toFixed(2));

export function Frame({ title, desc, yLabel, xLabel, max, children }: { title: string; desc: string; yLabel: string; xLabel: string; max: number; children: React.ReactNode }) {
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
      <div className="scroll" tabIndex={0}>
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
export function EarnedValueChart({ dates, pv, statusDate, ev, ac, acNote }: { dates: string[]; pv: number[]; statusDate: string; ev: number | null; ac?: (number | null)[]; acNote?: string }) {
  if (dates.length < 2) return null;
  const acVals = (ac ?? []).filter((v): v is number => v !== null);
  const hasAc = acVals.length > 0;
  const max = niceMax(Math.max(...pv, ev ?? 0, ...acVals));
  const x = (i: number) => L + (i / (dates.length - 1)) * PW;
  const y = (v: number) => T + PH - (v / max) * PH;
  const path = pv.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const acPath = (ac ?? []).map((v, i) => (v === null ? '' : `${i === 0 || (ac ?? [])[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter((t) => t !== '').join(' ');
  // status date position: last counted day on or before it
  let si = -1;
  dates.forEach((d, i) => { if (d <= statusDate) si = i; });
  const showEv = ev !== null && si >= 0;
  const pvAtStatus = si >= 0 ? (pv[si] ?? null) : null;
  const acAtStatus = hasAc && si >= 0 ? ((ac ?? [])[si] ?? null) : null;
  const hours = (n: number) => `${+n.toFixed(2)} h`;
  return (
    <figure className="viz-root">
      <figcaption><strong>Planned value{hasAc ? ', earned value and actual cost' : ' and earned value'} (hours)</strong></figcaption>
      <div className="viz-legend" aria-hidden="true">
        <span><i className="sw sw-1" /> Planned value (plan)</span>
        {showEv && <span><i className="sw sw-2" /> Earned value at status date</span>}
        {hasAc && <span><i className="sw sw-3" /> Actual cost (dashed)</span>}
      </div>
      <Frame title="Planned value, earned value and actual cost" desc={`Planned value rises to ${hours(pv[pv.length - 1] ?? 0)} by ${dates[dates.length - 1] ?? ''}.${showEv ? ` Earned value at ${statusDate} is ${hours(ev as number)}.` : ''}${acAtStatus !== null ? ` Actual cost at ${statusDate} is ${hours(acAtStatus)}.` : ''}`} yLabel="Hours" xLabel="Date" max={max}>
        <text className="viz-tick" x={L} y={H - 22} textAnchor="start">{dates[0] ?? ''}</text>
        <text className="viz-tick" x={W - R} y={H - 22} textAnchor="end">{dates[dates.length - 1] ?? ''}</text>
        <path className="viz-line s1" d={path} />
        {hasAc && acPath && <path className="viz-line s3" d={acPath} />}
        {si >= 0 && <line className="viz-ref" x1={x(si)} x2={x(si)} y1={T} y2={T + PH} />}
        {si >= 0 && <text className="viz-tick" x={Math.min(Math.max(x(si), L + 30), W - R - 30)} y={H - 8} textAnchor="middle">Status {statusDate}</text>}
        {showEv && (
          <g>
            <circle className="viz-dot s2" cx={x(si)} cy={y(ev as number)} r={5}><title>{`Earned value ${hours(ev as number)} at ${statusDate}`}</title></circle>
            <text className="viz-label" x={x(si) + 10} y={y(ev as number) - 8}>EV {hours(ev as number)}</text>
          </g>
        )}
        {acAtStatus !== null && (
          <g>
            <circle className="viz-dot s3" cx={x(si)} cy={y(acAtStatus)} r={4}><title>{`Actual cost ${hours(acAtStatus)} at ${statusDate}`}</title></circle>
            <text className="viz-label" x={x(si) + 10} y={y(acAtStatus) + 14}>AC {hours(acAtStatus)}</text>
          </g>
        )}
        {pvAtStatus !== null && (
          <circle className="viz-dot s1" cx={x(si)} cy={y(pvAtStatus)} r={4}><title>{`Planned value ${hours(pvAtStatus)} at ${statusDate}`}</title></circle>
        )}
      </Frame>
      {acNote && <p className="note">{acNote}</p>}
      <ChartTable
        caption={hasAc ? 'Planned value and actual cost by day (hours)' : 'Planned value by day (hours)'}
        head={hasAc ? ['Date', 'Planned value (h)', 'Actual cost (h)'] : ['Date', 'Planned value (h)']}
        rows={dates.map((d, i) => (hasAc ? [d, +(pv[i] ?? 0).toFixed(2), (ac ?? [])[i] == null ? '-' : +((ac ?? [])[i] as number).toFixed(2)] : [d, +(pv[i] ?? 0).toFixed(2)]))}
      />
    </figure>
  );
}

/** Cumulative planned and actual amounts by month (hours or money). */
export function CashFlowChart({ rows, unit, statusDate }: { rows: { month: string; plannedCum: number; actualCum: number | null }[]; unit: string; statusDate: string }) {
  if (rows.length < 2) return null;
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.plannedCum, r.actualCum ?? 0)), 1));
  const x = (i: number) => L + (i / (rows.length - 1)) * PW;
  const y = (v: number) => T + PH - (v / max) * PH;
  const line = (f: (r: (typeof rows)[number]) => number | null) =>
    rows.map((r, i) => { const v = f(r); return v === null ? '' : `${i === 0 || f(rows[i - 1] as (typeof rows)[number]) === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).filter((t) => t !== '').join(' ');
  const last = [...rows].reverse().find((r) => r.actualCum !== null);
  const lastI = last ? rows.indexOf(last) : -1;
  const fmt = (n: number) => `${unit ? unit + ' ' : ''}${Math.round(n).toLocaleString('en-US')}`;
  return (
    <figure className="viz-root">
      <figcaption><strong>Cumulative planned and actual, by month ({unit || 'hours'})</strong></figcaption>
      <div className="viz-legend" aria-hidden="true">
        <span><i className="sw sw-1" /> Planned</span>
        <span><i className="sw sw-3" /> Actual (dashed, up to {statusDate})</span>
      </div>
      <Frame title="Cumulative planned and actual by month" desc={`Planned reaches ${fmt(rows[rows.length - 1]?.plannedCum ?? 0)} by ${rows[rows.length - 1]?.month ?? ''}.${last ? ` Actual is ${fmt(last.actualCum as number)} by ${last.month}.` : ''}`} yLabel={unit || 'Hours'} xLabel="Month" max={max}>
        {rows.map((r, i) => (i % Math.ceil(rows.length / 8) === 0 ? <text key={r.month} className="viz-tick" x={x(i)} y={H - 22} textAnchor="middle">{r.month}</text> : null))}
        <path className="viz-line s1" d={line((r) => r.plannedCum)} />
        <path className="viz-line s3" d={line((r) => r.actualCum)} />
        {last && lastI >= 0 && (
          <g>
            <circle className="viz-dot s3" cx={x(lastI)} cy={y(last.actualCum as number)} r={4}><title>{`Actual ${fmt(last.actualCum as number)} by ${last.month}`}</title></circle>
            <text className="viz-label" x={Math.min(x(lastI) + 8, W - R - 90)} y={y(last.actualCum as number) + 14}>Actual {fmt(last.actualCum as number)}</text>
          </g>
        )}
      </Frame>
      <ChartTable caption="Cumulative planned and actual by month" head={['Month', `Planned (${unit || 'hours'})`, `Actual (${unit || 'hours'})`]} rows={rows.map((r) => [r.month, Math.round(r.plannedCum), r.actualCum === null ? '-' : Math.round(r.actualCum)])} />
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

const RULER_MIN = 0.6, RULER_MAX = 1.4;

/** A ruler for a performance index (CPI or SPI): coloured zones from the thresholds and a marker at the value. 1.0 means exactly on plan. */
export function IndexRuler({ name, value, greenMin, amberMin, band }: { name: string; value: number | null; greenMin: number; amberMin: number; band: string }) {
  const w = 640, left = 12, right = 12, pw = w - left - right, barY = 30, barH = 14;
  const x = (v: number) => left + ((Math.min(RULER_MAX, Math.max(RULER_MIN, v)) - RULER_MIN) / (RULER_MAX - RULER_MIN)) * pw;
  const off = value !== null && (value < RULER_MIN || value > RULER_MAX);
  const label = value === null ? `${name} is not available.` : `${name} is ${+value.toFixed(2)}, ${band}.`;
  const f = (n: number) => String(+n.toFixed(2));
  return (
    <svg className="viz-svg ruler" viewBox={`0 0 ${w} 96`} role="img" aria-label={label}>
      <title>{label}</title>
      <rect className="zone zone-bad" x={x(RULER_MIN)} y={barY} width={x(amberMin) - x(RULER_MIN)} height={barH} />
      <rect className="zone zone-warn" x={x(amberMin)} y={barY} width={x(greenMin) - x(amberMin)} height={barH} />
      <rect className="zone zone-good" x={x(greenMin)} y={barY} width={x(RULER_MAX) - x(greenMin)} height={barH} />
      <line className="viz-ref" x1={x(1)} x2={x(1)} y1={barY - 4} y2={barY + barH + 4} />
      <text className="viz-tick" x={x(RULER_MIN)} y={barY + barH + 16} textAnchor="start">below {f(amberMin)}</text>
      <text className="viz-tick" x={(x(amberMin) + x(greenMin)) / 2} y={barY + barH + 16} textAnchor="middle">{f(amberMin)} to {f(greenMin)}</text>
      <text className="viz-tick" x={x(RULER_MAX)} y={barY + barH + 16} textAnchor="end">{f(greenMin)} and above</text>
      <text className="viz-tick" x={x(1)} y={barY + barH + 36} textAnchor="middle">1.0 = on plan</text>
      {value !== null && (
        <g>
          <polygon className="marker" points={`${x(value) - 7},${barY - 12} ${x(value) + 7},${barY - 12} ${x(value)},${barY - 1}`}><title>{label}</title></polygon>
          <text className="viz-label strong" x={Math.min(Math.max(x(value), 40), w - 40)} y={barY - 17} textAnchor="middle">{name} {f(value)}{off ? (value < RULER_MIN ? ' (off the scale, lower)' : ' (off the scale, higher)') : ''}</text>
        </g>
      )}
    </svg>
  );
}
