import {
  costPerformanceIndex,
  costVariance,
  eacTypical,
  schedulePerformanceIndex,
  scheduleVariance,
  tcpiToBac,
} from './evm';

/**
 * Links each metric recipe card (by id) to its formula function.
 * The registry test runs every card's worked example through the function registered here.
 */
export type MetricInputs = Record<string, number>;
export type MetricFunction = (inputs: MetricInputs) => number | null;

function need(inputs: MetricInputs, ...names: string[]): number[] {
  return names.map((name) => {
    const value = inputs[name];
    if (value === undefined) throw new Error(`Missing required input "${name}"`);
    return value;
  });
}

export const metricFunctions: Record<string, MetricFunction> = {
  'evm.sv': (i) => {
    const [ev, pv] = need(i, 'EV', 'PV') as [number, number];
    return scheduleVariance(ev, pv);
  },
  'evm.cv': (i) => {
    const [ev, ac] = need(i, 'EV', 'AC') as [number, number];
    return costVariance(ev, ac);
  },
  'evm.spi': (i) => {
    const [ev, pv] = need(i, 'EV', 'PV') as [number, number];
    return schedulePerformanceIndex(ev, pv);
  },
  'evm.cpi': (i) => {
    const [ev, ac] = need(i, 'EV', 'AC') as [number, number];
    return costPerformanceIndex(ev, ac);
  },
  'evm.eac_typical': (i) => {
    const [bac, ev, ac] = need(i, 'BAC', 'EV', 'AC') as [number, number, number];
    return eacTypical(bac, ev, ac);
  },
  'evm.tcpi_bac': (i) => {
    const [bac, ev, ac] = need(i, 'BAC', 'EV', 'AC') as [number, number, number];
    return tcpiToBac(bac, ev, ac);
  },
};
