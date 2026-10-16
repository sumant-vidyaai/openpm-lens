import { safeDivide } from './evm';

/**
 * Health status (red / amber / green) from the cost and schedule indexes.
 *
 * The thresholds are STARTING VALUES chosen by this project, not a standard. The user can
 * change them on screen. Rules:
 *  - an index at or above `greenMin` is green, at or above `amberMin` is amber, else red;
 *  - the overall status is the worst of the indexes that can be trusted;
 *  - an index is trusted only when at least `minTasks` tasks were used to work it out;
 *  - when no index can be trusted the status is "insufficient data", never a guessed colour.
 */
export interface HealthThresholds {
  greenMin: number;
  amberMin: number;
  minTasks: number;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = { greenMin: 0.95, amberMin: 0.85, minTasks: 5 };

export type Health = 'green' | 'amber' | 'red' | 'insufficient';

export const HEALTH_LABEL: Record<Health, string> = {
  green: 'Green: on track', amber: 'Amber: watch', red: 'Red: off track', insufficient: 'Insufficient data',
};

/** Returns an error message in plain words, or null when the thresholds can be used. */
export function validateThresholds(t: HealthThresholds): string | null {
  if (![t.greenMin, t.amberMin, t.minTasks].every((n) => Number.isFinite(n))) return 'Every threshold must be a number.';
  if (t.amberMin <= 0) return 'The amber limit must be above 0.';
  if (t.amberMin > t.greenMin) return 'The amber limit cannot be higher than the green limit.';
  if (!Number.isInteger(t.minTasks) || t.minTasks < 1) return 'The minimum number of tasks must be a whole number, 1 or more.';
  return null;
}

export function bandFor(index: number | null, t: HealthThresholds): Health {
  if (index === null || !Number.isFinite(index)) return 'insufficient';
  return index >= t.greenMin ? 'green' : index >= t.amberMin ? 'amber' : 'red';
}

export interface HealthInput {
  ev: number | null;
  ac: number | null;
  costTasks: number;
  evSchedule: number | null;
  pv: number | null;
  scheduleTasks: number;
}

export interface HealthResult {
  health: Health;
  cpi: number | null;
  spi: number | null;
  cpiBand: Health;
  spiBand: Health;
  /** Plain-language explanation of how the status was reached. */
  reasons: string[];
}

const RANK: Record<Health, number> = { green: 0, amber: 1, red: 2, insufficient: -1 };

export function assessHealth(input: HealthInput, t: HealthThresholds = DEFAULT_THRESHOLDS): HealthResult {
  const reasons: string[] = [];
  let cpi: number | null = null;
  let spi: number | null = null;
  if (input.ev !== null && input.ac !== null) cpi = safeDivide(input.ev, input.ac);
  if (input.evSchedule !== null && input.pv !== null) spi = safeDivide(input.evSchedule, input.pv);

  let cpiBand = bandFor(cpi, t);
  let spiBand = bandFor(spi, t);
  if (cpi === null) reasons.push('Cost index (CPI) not available.');
  else if (input.costTasks < t.minTasks) {
    reasons.push(`CPI not used: only ${input.costTasks} task${input.costTasks === 1 ? '' : 's'} behind it; the minimum is ${t.minTasks}.`);
    cpiBand = 'insufficient';
  }
  if (spi === null) reasons.push('Schedule index (SPI) not available (needs a status date and planned dates).');
  else if (input.scheduleTasks < t.minTasks) {
    reasons.push(`SPI not used: only ${input.scheduleTasks} task${input.scheduleTasks === 1 ? '' : 's'} behind it; the minimum is ${t.minTasks}.`);
    spiBand = 'insufficient';
  }

  const bands = [cpiBand, spiBand].filter((b) => b !== 'insufficient');
  if (bands.length === 0) {
    return { health: 'insufficient', cpi, spi, cpiBand, spiBand, reasons };
  }
  const health = bands.reduce((worst, b) => (RANK[b] > RANK[worst] ? b : worst));
  if (cpiBand !== 'insufficient') reasons.push(`CPI ${cpi === null ? '' : round2(cpi)} is ${cpiBand}.`);
  if (spiBand !== 'insufficient') reasons.push(`SPI ${spi === null ? '' : round2(spi)} is ${spiBand}.`);
  reasons.push(
    `Green at ${t.greenMin} or above, amber at ${t.amberMin} or above, red below. Overall = the worst of the indexes that could be used.`,
  );
  return { health, cpi, spi, cpiBand, spiBand, reasons };
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
