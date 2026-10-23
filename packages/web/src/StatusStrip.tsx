import { useMemo } from 'react';
import { HEALTH_LABEL, roundHalfUp, type Health } from '@openpm-lens/core';
import { buildFacts } from './StatusReport';
import type { SharedData } from './shared';

const SYMBOL: Record<Health, string> = { green: '●', amber: '▲', red: '■', insufficient: '○' };

/** A thin line at the top of every tab: which file, which date, how healthy, and the headline numbers. */
export function StatusStrip({ shared }: { shared: SharedData | null }) {
  const f = useMemo(() => (shared && shared.statusDate ? buildFacts(shared) : null), [shared]);
  if (!shared) return null;
  const active = f?.counts ? f.counts.total - f.counts.cancelled : 0;
  const x = (n: number | null) => (n === null ? 'n/a' : String(roundHalfUp(n, 2)));
  return (
    <div className={`strip noprint strip-${f ? f.health : 'insufficient'}`} role="status" aria-label="Project status">
      <span className="strip-file">{shared.fileName}</span>
      <span>{shared.statusDate ? `as of ${shared.statusDate}` : 'no status date yet'}</span>
      {f && <strong><span aria-hidden="true">{SYMBOL[f.health]} </span>{HEALTH_LABEL[f.health]}</strong>}
      {f && <span>CPI {x(f.cpi)}</span>}
      {f && <span>SPI {x(f.spi)}</span>}
      {f?.counts && active > 0 && <span>{f.counts.done} of {active} done</span>}
      {f?.forecast?.date85 && <span>85% finish by {f.forecast.date85}</span>}
    </div>
  );
}
