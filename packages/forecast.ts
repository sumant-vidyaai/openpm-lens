import { costPerformanceIndex, eacAtypical, eacCpiSpi, eacTypical, estimateToComplete, schedulePerformanceIndex, tcpiToBac, tcpiToEac, varianceAtCompletion } from './evm';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';

/**
 * Forecast figures: EAC, ETC, VAC and TCPI.
 *
 * The estimate at completion (EAC) depends on an assumption about the rest of the work, so the
 * user chooses the method and the choice is shown. BAC here is the planned hours of the tasks
 * used in the earned-value numbers, NOT necessarily the whole project: tasks left out are not in it.
 */
export type EacMethod = 'typical' | 'atypical' | 'cpi_spi';

export const EAC_METHODS: { value: EacMethod; label: string; formula: string; when: string }[] = [
  { value: 'typical', label: 'Same efficiency continues (BAC / CPI)', formula: 'EAC = BAC / CPI', when: 'The cost performance so far is expected to continue for the rest of the work.' },
  { value: 'atypical', label: 'Rest goes to plan (AC + BAC - EV)', formula: 'EAC = AC + (BAC - EV)', when: 'The overrun or underrun so far was a one-off and the remaining work will go to plan.' },
  { value: 'cpi_spi', label: 'Cost and schedule both matter (AC + (BAC - EV) / (CPI x SPI))', formula: 'EAC = AC + (BAC - EV) / (CPI x SPI)', when: 'Being late as well as over or under budget affects the cost of the remaining work. Needs a status date.' },
];

export interface ForecastInput {
  ev: number | null;
  ac: number | null;
  bac: number | null;
  /** Planned value at the status date (from the schedule measures), or null if not worked out. */
  pv: number | null;
  /** Earned value over the schedule tasks, for SPI; defaults to ev. */
  evSchedule?: number | null;
}

export interface ForecastResult {
  method: EacMethod;
  bac: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpiBac: number | null;
  tcpiEac: number | null;
  /** Plain-language reasons why a figure is not available or not meaningful. */
  reasons: string[];
  steps: StepGroup[];
}

const n = (x: number | null, d = 2) => (x === null ? 'not available' : String(roundHalfUp(x, d)));

export function forecast(input: ForecastInput, method: EacMethod): ForecastResult {
  const { ev, ac, bac, pv } = input;
  const reasons: string[] = [];
  const empty: ForecastResult = { method, bac, eac: null, etc: null, vac: null, tcpiBac: null, tcpiEac: null, reasons, steps: [] };
  if (ev === null || ac === null || bac === null) {
    reasons.push('Forecasts need earned value, actual cost and budget; none could be worked out from this file.');
    return empty;
  }
  const spiEv = input.evSchedule ?? ev;
  let eac: number | null = null;
  if (method === 'typical') {
    eac = eacTypical(bac, ev, ac);
    if (eac === null) reasons.push('EAC = BAC / CPI is not available: CPI could not be worked out (actual cost is 0 or earned value is 0).');
  } else if (method === 'atypical') {
    eac = eacAtypical(bac, ev, ac);
  } else {
    if (pv === null) reasons.push('This method needs a status date and planned dates, to work out SPI.');
    else {
      eac = eacCpiSpi(bac, spiEv, ac, pv);
      if (eac === null) reasons.push('EAC with CPI x SPI is not available: CPI or SPI could not be worked out (a zero in earned value, planned value or actual cost).');
    }
  }
  const etc = eac === null ? null : estimateToComplete(eac, ac);
  const vac = eac === null ? null : varianceAtCompletion(bac, eac);

  let tcpiB = tcpiToBac(bac, ev, ac);
  if (bac - ac <= 0) {
    tcpiB = null;
    reasons.push('TCPI against the budget is not meaningful: the hours spent already equal or exceed the budget, so finishing within it is not possible.');
  }
  let tcpiE: number | null = eac === null ? null : tcpiToEac(bac, ev, ac, eac);
  if (eac !== null && eac - ac <= 0) {
    tcpiE = null;
    reasons.push('TCPI against the forecast is not meaningful: the forecast says no more hours will be needed.');
  }

  const steps: StepGroup[] = [];
  steps.push({ label: 'Budget at completion (BAC)', steps: ['BAC = sum of planned hours of the tasks used', `BAC = ${n(bac)} hours (tasks left out are not in it)`] });
  const m = EAC_METHODS.find((x) => x.value === method);
  if (eac !== null && m) {
    const cpi = costPerformanceIndex(ev, ac);
    const spi = pv === null ? null : schedulePerformanceIndex(spiEv, pv);
    const sub =
      method === 'typical' ? [`EAC = ${n(bac)} / ${n(cpi, 4)}`]
      : method === 'atypical' ? [`EAC = ${n(ac)} + (${n(bac)} - ${n(ev)})`]
      : [`EAC = ${n(ac)} + (${n(bac)} - ${n(ev)}) / (${n(cpi, 4)} x ${n(spi, 4)})`];
    steps.push({ label: 'Estimate at completion (EAC)', steps: [m.formula, ...sub, `EAC = ${n(eac)} hours`] });
    steps.push({ label: 'Estimate to complete (ETC)', steps: ['ETC = EAC - AC', `ETC = ${n(eac)} - ${n(ac)}`, `ETC = ${n(etc)} hours`] });
    steps.push({ label: 'Variance at completion (VAC)', steps: ['VAC = BAC - EAC', `VAC = ${n(bac)} - ${n(eac)}`, `VAC = ${n(vac)} hours (negative means a forecast overrun)`] });
  }
  if (tcpiB !== null) {
    steps.push({ label: 'To-complete index against the budget (TCPI)', steps: ['TCPI = (BAC - EV) / (BAC - AC)', `TCPI = (${n(bac)} - ${n(ev)}) / (${n(bac)} - ${n(ac)})`, `TCPI = ${n(tcpiB, 4)}: the CPI the remaining work must achieve to finish within the budget`] });
  }
  if (tcpiE !== null && eac !== null) {
    steps.push({ label: 'To-complete index against the forecast (TCPI on EAC)', steps: ['TCPI = (BAC - EV) / (EAC - AC)', `TCPI = (${n(bac)} - ${n(ev)}) / (${n(eac)} - ${n(ac)})`, `TCPI = ${n(tcpiE, 4)}`] });
  }
  return { method, bac, eac, etc, vac, tcpiBac: tcpiB, tcpiEac: tcpiE, reasons, steps };
}
