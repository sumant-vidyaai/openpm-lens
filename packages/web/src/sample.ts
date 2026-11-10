import type { Criterion, OptionScores, RiskInput } from '@spashta/core';
// Synthetic example only. Not real project data.
export const SAMPLE_CSV = [
  'Task,Status,Estimate (h),Actual (h),% Complete',
  'Design screens,Done,40,46,100',
  'Build login,In Progress,60,30,50%',
  'Build reports,In Progress,80,20,25%',
  'Write test plan,To Do,16,,0',
  'Set up hosting,Done,,12,100',
  'Training material,Waiting on legal,24,,',
].join('\n');

// Three made-up projects for the portfolio view. Not real project data.
const HEAD = 'Task,Status,Estimate (h),Actual (h),% Complete,Start,Finish,Assigned to';
export const SAMPLE_PORTFOLIO: { name: string; programme: string; team: string; csv: string }[] = [
  {
    name: 'Website redesign', programme: 'Digital', team: 'Web team',
    csv: [HEAD,
      'Design,Done,40,44,100,2026-01-05,2026-01-09,Meera',
      'Build,In Progress,80,30,50,2026-01-12,2026-01-23,Asha',
      'Content,In Progress,30,10,40,2026-01-12,2026-01-16,Kiran',
      'Testing,To Do,24,0,0,2026-01-26,2026-01-30,Kiran',
      'Launch,To Do,16,0,0,2026-02-02,2026-02-03,Meera',
      'Training,Done,10,12,100,2026-01-05,2026-01-07,Kiran'].join('\n'),
  },
  {
    name: 'Mobile app', programme: 'Digital', team: 'App team',
    csv: [HEAD,
      'Spec,Done,20,20,100,2026-01-05,2026-01-08,Ravi',
      'API,In Progress,60,40,70,2026-01-12,2026-01-23,Asha',
      'UI,In Progress,50,25,50,2026-01-12,2026-01-30,Ravi',
      'QA,To Do,20,0,0,2026-02-02,2026-02-06,Kiran',
      'Docs,In Progress,10,5,50,2026-01-19,2026-01-23,Dev',
      'Setup,Done,8,8,100,2026-01-05,2026-01-06,Dev'].join('\n'),
  },
  {
    name: 'Data platform', programme: 'Data', team: 'Data team',
    csv: [HEAD,
      'Model,Done,40,50,100,2026-01-05,2026-01-09,Dev',
      'Pipeline,In Progress,60,40,50,2026-01-12,2026-01-23,Ravi',
      'Report,To Do,20,0,0,2026-01-26,2026-01-30,Meera'].join('\n'),
  },
];

// Made-up work items for the flow metrics example. Status date 2026-01-28. Not real project data.
export const SAMPLE_FLOW = [
  'ID,Title,Status,Started,Done',
  'A,Set up repo,Done,2026-01-05,2026-01-09',
  'B,Login page,Done,2026-01-12,2026-01-16',
  'C,Search,Done,2026-01-14,2026-01-20',
  'D,Profile,Done,2026-01-19,2026-01-23',
  'E,Reports,Done,2026-01-20,2026-01-27',
  'F,Export,Done,2026-01-22,2026-01-28',
  'G,Billing,In Progress,2026-01-10,',
  'H,Notifications,In Progress,2026-01-26,',
  'I,Old idea,Cancelled,2026-01-10,',
  'J,Quick fix,Done,,2026-01-21',
  'K,Docs,Done,2026-01-10,',
  'L,Typo,Done,2026-01-05,2026-01-03',
  'M,Next release,In Progress,2026-02-02,',
].join('\n');

// Made-up project register for the three sample projects (names match). Status date for the sample is 2026-01-21.
export const SAMPLE_REGISTER: { project: string; phase: string; manager: string; lastUpdated: string | null; nextGate: string | null }[] = [
  { project: 'Website redesign', phase: 'Build', manager: 'Meera (made up)', lastUpdated: '2026-01-19', nextGate: '2026-02-06' },
  { project: 'Mobile app', phase: 'Plan', manager: 'Dev (made up)', lastUpdated: '2026-01-02', nextGate: '2026-01-16' },
  { project: 'Data platform', phase: 'Idea', manager: 'Meera (made up)', lastUpdated: null, nextGate: '2026-03-01' },
];
export const SAMPLE_PHASE_ORDER = 'Idea, Plan, Build, Test, Launch';
export const SAMPLE_UPDATE_DUE = '14';

// Made-up risks, priorities and weekly hours for the portfolio example. Not real project data.
export const SAMPLE_CAPACITY = '40';
export const SAMPLE_RISKS: RiskInput[] = [
  { id: 'W1', title: 'Content arrives late', owner: 'Meera', response: 'Agree dates with the content owner', action: 'Confirm dates', probability: 4, impact: 3, status: 'open', actionDue: '2026-01-23', actionDone: null, project: 'Website redesign' },
  { id: 'W2', title: 'Hosting outage at launch', owner: 'Kiran', response: 'Book a standby window', action: '', probability: 2, impact: 4, status: 'open', actionDue: null, actionDone: null, project: 'Website redesign' },
  { id: 'M1', title: 'Key developer leaves', owner: 'Dev', response: 'Cross-train a second developer', action: 'Start cross-training', probability: 3, impact: 5, status: 'open', actionDue: '2026-01-14', actionDone: null, project: 'Mobile app' },
  { id: 'M2', title: 'App store rejects the first build', owner: 'Ravi', response: 'Pre-check the store rules', action: '', probability: 2, impact: 3, status: 'open', actionDue: null, actionDone: null, project: 'Mobile app' },
  { id: 'D1', title: 'Source data is not clean', owner: 'Meera', response: 'Add checks at load', action: 'Draft the checks', probability: 4, impact: 4, status: 'open', actionDue: '2026-01-30', actionDone: null, project: 'Data platform' },
  { id: 'D2', title: 'Licence cost rises', owner: 'Dev', response: 'Accept', action: '', probability: 3, impact: 2, status: 'closed', actionDue: null, actionDone: null, project: 'Data platform' },
];
export const SAMPLE_PRIORITY: { criteria: Criterion[]; options: OptionScores[] } = {
  criteria: [{ name: 'Strategic fit', weight: 5 }, { name: 'Value', weight: 3 }, { name: 'Ease', weight: 2 }],
  options: [
    { option: 'Website redesign', scores: { 'Strategic fit': 3, Value: 4, Ease: 4 } },
    { option: 'Mobile app', scores: { 'Strategic fit': 5, Value: 4, Ease: 2 } },
    { option: 'Data platform', scores: { 'Strategic fit': 4, Value: 5, Ease: 2 } },
  ],
};
