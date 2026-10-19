import { daysApart } from '@openpm-lens/core';
import { ChartTable, Frame, H, L, niceMax, PH, PW, R, T, W } from './charts';

/* Trend charts over snapshot status dates. Plain SVG; colours come from CSS classes. The horizontal position is proportional to the days between status dates. */
type Cls = 's1' | 's2' | 's3';
export interface TrendSeries { name: string; cls: Cls; values: (number | null)[] }

const SW: Record<Cls, string> = { s1: 'sw-1', s2: 'sw-2', s3: 'sw-3' };
/** Axis top for counts: a multiple of 4 (at least 4), so the four tick steps are whole numbers. */
const countMax = (v: number) => Math.max(4, Math.ceil(v / 4) * 4);
const show = (n: number | null, d: number) => (n === null ? '-' : +n.toFixed(d));

function xOf(dates: string[]) {
  const first = dates[0] ?? '', last = dates[dates.length - 1] ?? '';
  const span = daysApart(first, last);
  return (d: string) => (span <= 0 ? L + PW / 2 : L + (daysApart(first, d) / span) * PW);
}

export function TrendChart({ title, yLabel, dates, series, refLine, decimals = 2, note }: {
  title: string; yLabel: string; dates: string[]; series: TrendSeries[]; refLine?: { value: number; label: string }; decimals?: number; note?: string;
}) {
  const vals = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (dates.length === 0 || vals.length === 0) return null;
  const top = Math.max(...vals, refLine?.value ?? 0, 0.0001) * (refLine ? 1.15 : 1);
  const max = decimals === 0 ? countMax(top) : niceMax(top);
  const x = xOf(dates);
  const y = (v: number) => T + PH - (v / max) * PH;
  const desc = series.map((s) => {
    const pts = s.values.map((v, i) => (v === null ? null : `${show(v, decimals)} on ${dates[i]}`)).filter((t) => t !== null);
    return `${s.name}: ${pts.join(', ')}`;
  }).join('. ');
  return (
    <figure className="viz-root">
      <figcaption><strong>{title}</strong></figcaption>
      {series.length > 1 && (
        <div className="viz-legend" aria-hidden="true">
          {series.map((s) => <span key={s.name}><i className={`sw ${SW[s.cls]}`} /> {s.name}{s.cls === 's3' ? ' (dashed)' : ''}</span>)}
        </div>
      )}
      <Frame title={title} desc={desc} yLabel={yLabel} xLabel="Status date" max={max}>
        <text className="viz-tick" x={L} y={H - 22} textAnchor="start">{dates[0] ?? ''}</text>
        {dates.length > 1 && <text className="viz-tick" x={W - R} y={H - 22} textAnchor="end">{dates[dates.length - 1] ?? ''}</text>}
        {refLine && (
          <g>
            <line className="viz-ref" x1={L} x2={W - R} y1={y(refLine.value)} y2={y(refLine.value)} />
            <text className="viz-tick" x={W - R} y={y(refLine.value) - 4} textAnchor="end">{refLine.label}</text>
          </g>
        )}
        {series.map((s) => {
          const d = s.values.map((v, i) => (v === null ? '' : `${i === 0 || s.values[i - 1] === null ? 'M' : 'L'}${x(dates[i] as string).toFixed(1)},${y(v).toFixed(1)}`)).filter((t) => t !== '').join(' ');
          return <path key={s.name} className={`viz-line ${s.cls}`} d={d} />;
        })}
        {series.map((s) => s.values.map((v, i) => (v === null ? null : (
          <circle key={`${s.name}${i}`} className={`viz-dot ${s.cls}`} cx={x(dates[i] as string)} cy={y(v)} r={5}>
            <title>{`${s.name} ${show(v, decimals)} on ${dates[i]}`}</title>
          </circle>
        ))))}
      </Frame>
      {note && <p className="note">{note}</p>}
      <ChartTable caption={title} head={['Status date', ...series.map((s) => s.name)]} rows={dates.map((d, i) => [d, ...series.map((s) => show(s.values[i] ?? null, decimals))])} />
    </figure>
  );
}

/** Stacked areas (bottom layer first), for the cumulative flow of task counts. */
export function StackedChart({ title, yLabel, dates, layers, note }: { title: string; yLabel: string; dates: string[]; layers: { name: string; cls: Cls; values: number[] }[]; note?: string }) {
  if (dates.length < 2) return null;
  const totals = dates.map((_, i) => layers.reduce((a, l) => a + (l.values[i] ?? 0), 0));
  const max = countMax(Math.max(...totals, 1));
  const x = xOf(dates);
  const y = (v: number) => T + PH - (v / max) * PH;
  let lower = dates.map(() => 0);
  const polys = layers.map((l) => {
    const upper = lower.map((b, i) => b + (l.values[i] ?? 0));
    const top = dates.map((d, i) => `${x(d).toFixed(1)},${y(upper[i] as number).toFixed(1)}`);
    const bottom = dates.map((d, i) => `${x(d).toFixed(1)},${y(lower[i] as number).toFixed(1)}`).reverse();
    const p = { name: l.name, cls: l.cls, points: [...top, ...bottom].join(' ') };
    lower = upper;
    return p;
  });
  const desc = layers.map((l) => `${l.name}: ${l.values.join(', ')}`).join('. ');
  return (
    <figure className="viz-root">
      <figcaption><strong>{title}</strong></figcaption>
      <div className="viz-legend" aria-hidden="true">
        {[...layers].reverse().map((l) => <span key={l.name}><i className={`sw ${SW[l.cls]}`} /> {l.name}</span>)}
      </div>
      <Frame title={title} desc={desc} yLabel={yLabel} xLabel="Status date" max={max}>
        <text className="viz-tick" x={L} y={H - 22} textAnchor="start">{dates[0] ?? ''}</text>
        <text className="viz-tick" x={W - R} y={H - 22} textAnchor="end">{dates[dates.length - 1] ?? ''}</text>
        {polys.map((p) => <polygon key={p.name} className={`viz-area ${p.cls}`} points={p.points}><title>{p.name}</title></polygon>)}
      </Frame>
      {note && <p className="note">{note}</p>}
      <ChartTable caption={title} head={['Status date', ...layers.map((l) => l.name)]} rows={dates.map((d, i) => [d, ...layers.map((l) => l.values[i] ?? 0)])} />
    </figure>
  );
}
