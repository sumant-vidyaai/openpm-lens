import { updateDiscipline } from './control';
import { summariseBenefits } from './close';
import { businessCase, gridQuadrant, QUADRANT_LABEL, scoreOptions } from './initiate';
import { analyseNetwork } from './network';
import { reserveCheck, reserveStack } from './reserves';
import { pertEstimate } from './threePoint';
import { roundHalfUp } from './format';
import { costPerformanceIndex, costVariance, eacTypical, schedulePerformanceIndex, tcpiToBac } from './evm';

/**
 * Practice questions for the Learn tab. Every number in a question, its choices and its explanation is calculated here by the
 * same functions the app uses, so a practice answer can never disagree with a result on screen. The right answer is the one at `answer`.
 */
export interface PracticeQuestion { id: string; topic: string; prompt: string; choices: string[]; answer: number; explain: string }
export interface CaseStudy { title: string; story: string; steps: PracticeQuestion[] }

const n = (x: number | null, d = 2): string => (x === null ? '?' : String(roundHalfUp(x, d)));
const money = (x: number): string => roundHalfUp(x, 2).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Puts the right answer at `pos` among the wrong ones, in a fixed order (no randomness). */
function q(id: string, topic: string, prompt: string, right: string, wrong: string[], pos: number, explain: string): PracticeQuestion {
  const choices = [...wrong];
  choices.splice(Math.min(pos, wrong.length), 0, right);
  return { id, topic, prompt, choices, answer: choices.indexOf(right), explain };
}

export function practiceQuestions(): PracticeQuestion[] {
  const cpi = costPerformanceIndex(80, 100) as number;
  const spi = schedulePerformanceIndex(90, 120) as number;
  const eac = eacTypical(1000, 400, 500) as number;
  const tcpi = tcpiToBac(1000, 400, 500) as number;
  const pert = pertEstimate(2, 4, 12);
  const net = analyseNetwork([{ id: 'A', duration: 5, preds: [] }, { id: 'B', duration: 10, preds: ['A'] }, { id: 'C', duration: 2, preds: ['A'] }, { id: 'D', duration: 5, preds: ['B', 'C'] }]);
  const floatC = net.rows.find((r) => r.id === 'C')?.totalFloat as number;
  const bc = businessCase([{ period: 0, cost: 50000, benefit: 0 }, { period: 1, cost: 0, benefit: 20000 }, { period: 2, cost: 0, benefit: 25000 }, { period: 3, cost: 0, benefit: 15000 }], 0.08)!;
  const sc = scoreOptions([{ name: 'Price', weight: 40 }, { name: 'Fit', weight: 30 }, { name: 'Support', weight: 30 }], [{ option: 'C', scores: { Price: 8.5, Fit: 9, Support: 10 } }]).options[0]?.score as number;
  const ben = summariseBenefits([{ id: 'b', name: 'b', owner: '', measure: 'k', planned: 404000, realised: 370000, due: null }]);
  const stack = reserveStack(10000, 600, 500);
  const quad = gridQuadrant(5, 1, 4);
  const upd = updateDiscipline([{ project: 'P', phase: '', manager: '', lastUpdated: '2026-03-16', nextGate: null }], '2026-03-31', 14).rows[0]!;
  return [
    q('cpi', 'Cost', 'Earned value is 80 hours and 100 hours have been spent. What is the cost performance index (CPI)?', n(cpi), [n(100 / 80), n(costVariance(80, 100)), n(0.2)], 1, `CPI = EV / AC = 80 / 100 = ${n(cpi)}. Below 1 means less work done than the hours spent would suggest. Dividing the other way round (${n(100 / 80)}) is a common slip.`),
    q('spi', 'Schedule', 'Earned value is 90 and planned value is 120. What is the schedule performance index (SPI)?', n(spi), [n(120 / 90), n(90 - 120), n(0.25)], 2, `SPI = EV / PV = 90 / 120 = ${n(spi)}. Below 1 means behind the plan. The difference, -30, is the schedule variance (SV), not the index.`),
    q('eac', 'Forecast', 'Budget at completion (BAC) is 1,000, earned value is 400 and actual cost is 500. If today\'s cost performance continues, what is the typical estimate at completion (EAC = BAC / CPI)?', n(eac, 0), [n(500 + (1000 - 400), 0), '1,000', '1,500'], 0, `CPI = 400 / 500 = 0.8, so EAC = 1,000 / 0.8 = ${n(eac, 0)}. The 1,100 answer (AC + remaining budget) is a different forecast that assumes the rest goes exactly to plan.`),
    q('tcpi', 'Forecast', 'With the same numbers (BAC 1,000, EV 400, AC 500), what efficiency is needed from now on to finish within budget (TCPI)?', n(tcpi), [n(0.8), n(1.25), n(0.6)], 3, `TCPI = (BAC - EV) / (BAC - AC) = 600 / 500 = ${n(tcpi)}. Above 1 means the rest of the work must go better than it has so far.`),
    q('pert', 'Planning', 'A task is estimated at optimistic 2, most likely 4 and pessimistic 12 hours. What is the PERT expected value?', n(pert.expected, 0), [n((2 + 4 + 12) / 3, 0), '4', '7'], 1, `Expected = (O + 4M + P) / 6 = (2 + 16 + 12) / 6 = ${n(pert.expected, 0)}. The most likely value counts four times. A plain average would give 6.`),
    q('float', 'Planning', 'A (5 days) comes first. Then B (10 days) and C (2 days) both follow A. D (5 days) follows B and C. How many days can C slip without delaying the project?', String(floatC), ['0', '2', String(net.duration)], 2, `The longest path A, B, D is ${net.duration} days. C only needs 2 days between A and D, which leaves ${floatC} days of float. Tasks with 0 float (A, B, D) are critical.`),
    q('npv', 'Initiate', 'A project costs 50,000 now and returns 20,000, 25,000 and 15,000 at the end of years 1, 2 and 3. At 8% a year, what is the NPV?', money(bc.npv as number), [money(60000 - 50000), money(bc.pvBenefit as number), money(-(bc.npv as number))], 0, `Discounted benefits are ${money(bc.pvBenefit as number)}; minus the 50,000 cost gives ${money(bc.npv as number)}. Adding the raw amounts (10,000) ignores that later money is worth less.`),
    q('score', 'Initiate', 'Weights are Price 40, Fit 30 and Support 30. Vendor C scores 8.5, 9 and 10. What is its weighted score?', n(sc), [n((8.5 + 9 + 10) / 3), '91', '8.5'], 3, `Score = sum(weight x score) / sum of weights = (340 + 270 + 300) / 100 = ${n(sc)}. A plain average of the scores would ignore how much each criterion matters.`),
    q('bpi', 'Close', 'A benefit was planned at 404,000 and 370,000 has been realised. What is the benefit performance index (realised / planned)?', n(ben.bpi), [n(404000 / 370000), n(-34000, 0), n(0.08)], 2, `BPI = 370,000 / 404,000 = ${n(ben.bpi, 3)}, about ${n(ben.bpi)}. The variance is ${n(ben.variance, 0)} (realised minus planned).`),
    q('grid', 'Initiate', 'A stakeholder has high power but low interest in the project. Where do they go on the power / interest grid?', QUADRANT_LABEL[quad as keyof typeof QUADRANT_LABEL], [QUADRANT_LABEL.manage_closely, QUADRANT_LABEL.keep_informed, QUADRANT_LABEL.monitor], 1, 'High power and low interest means keep satisfied: they can affect the project, so keep them updated and ask for their views, without overloading them.'),
    q('reserve', 'Planning', 'A work estimate is 10,000, contingency reserve 600 and management reserve 500. What is the project budget?', n(stack.budget, 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','), ['10,600', '10,500', '11,600'], 2, `Cost baseline = estimate + contingency = ${n(stack.costBaseline, 0)}; project budget = cost baseline + management reserve = ${n(stack.budget, 0)}. The 10,600 answer is the cost baseline, which stops before the management reserve.`),
    q('risk', 'Risks', 'A risk has probability 4 and impact 3 (each on a 1 to 5 scale). What is its score?', String(4 * 3), ['7', '43', '5'], 1, 'Risk score = probability x impact = 12. The score is an ordering aid; scores are never added together.'),
    q('update', 'Portfolio', 'The status date is 31 March and a project was last updated on 16 March. The PMO says an update is overdue when it is more than 14 days old. What is the position?', `${upd.daysSince} days old: ${upd.state === 'overdue' ? 'overdue' : 'on time'}`, ['14 days old: on time', '15 days old: on time', '16 days old: overdue'], 1, `Days since update = 31 March minus 16 March = ${upd.daysSince}. That is more than 14, so it is overdue; exactly 14 days would still be on time.`),
    q('blank', 'Data', 'The Actual (h) cell for a task is blank. How should a metric treat it?', 'As not known: the task is left out of the calculation and listed', ['As 0 hours spent', 'As equal to the estimate', 'As the average of the other tasks'], 0, 'Blank means not known, which is different from 0. Counting it as 0 would make the project look cheaper than it is, so the app leaves the task out and says so.'),
  ];
}

/** The made-up "Website relaunch" project from the example file, at its status date of 2026-03-31. */
export function caseStudy(): CaseStudy {
  const ev = 326, ac = 385, bac = 594, contingency = 60, management = 40;
  const cpi = costPerformanceIndex(ev, ac) as number;
  const cv = costVariance(ev, ac) as number;
  const eac = eacTypical(bac, ev, ac) as number;
  const overrun = eac - bac;
  const chk = reserveCheck(reserveStack(bac, contingency, management), overrun);
  return {
    title: 'Case study: the website and mobile project at 31 March',
    story: `You are the project manager. The plan was ${bac} hours of work. At the status date the finished and part-finished work is worth ${ev} hours (earned value) and ${ac} hours have been spent. You set aside ${contingency} hours of contingency reserve and your sponsor holds ${management} hours of management reserve. Work through what this means, then compare with the example file on the Import tab.`,
    steps: [
      q('c1', 'Case study', 'Step 1. How is the project performing on cost (CPI)?', n(cpi), [n(ac / ev), n(cv, 0), n(ev / bac)], 1, `CPI = EV / AC = ${ev} / ${ac} = ${n(cpi, 4)}, about ${n(cpi)}. For every hour spent, about ${n(cpi)} hours of planned work was earned: over budget.`),
      q('c2', 'Case study', 'Step 2. What is the cost variance (EV - AC)?', n(cv, 0), [n(ac - ev, 0), n(ev - bac, 0), n(0, 0)], 2, `CV = ${ev} - ${ac} = ${n(cv, 0)} hours. Negative means over budget for the work done so far.`),
      q('c3', 'Case study', 'Step 3. If this cost performance continues, what is the typical estimate at completion (BAC / CPI)?', n(eac, 1), [n(ac + (bac - ev), 1), String(bac), n(bac * cpi, 1)], 3, `EAC = ${bac} / ${n(cpi, 4)} = ${n(eac, 1)} hours. The assumption is that the rest of the work costs as much more per hour as the first part did; it is a rule of thumb, not a prediction.`),
      q('c4', 'Case study', 'Step 4. How big is the expected overrun, and do the reserves cover it?', `${n(overrun, 1)} hours: more than contingency and management reserve together (${contingency + management} hours)`, [`${n(overrun, 1)} hours: covered by the contingency reserve alone`, `${n(overrun, 1)} hours: needs the management reserve but fits within it`, 'No overrun is expected'], 0, `Overrun = ${n(eac, 1)} - ${bac} = ${n(overrun, 1)} hours. Contingency covers ${contingency}; the next ${management} hours would come from the management reserve (state: ${chk.state.replace('_', ' ')}); that still leaves ${n(chk.beyondBudget, 1)} hours beyond the whole budget. Time to talk to the sponsor, ideally with options.`),
    ],
  };
}
