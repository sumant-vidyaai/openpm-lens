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
const HEAD = 'Task,Status,Estimate (h),Actual (h),% Complete,Start,Finish';
export const SAMPLE_PORTFOLIO: { name: string; programme: string; team: string; csv: string }[] = [
  {
    name: 'Website redesign', programme: 'Digital', team: 'Web team',
    csv: [HEAD,
      'Design,Done,40,44,100,2026-01-05,2026-01-09',
      'Build,In Progress,80,30,50,2026-01-12,2026-01-23',
      'Content,In Progress,30,10,40,2026-01-12,2026-01-16',
      'Testing,To Do,24,0,0,2026-01-26,2026-01-30',
      'Launch,To Do,16,0,0,2026-02-02,2026-02-03',
      'Training,Done,10,12,100,2026-01-05,2026-01-07'].join('\n'),
  },
  {
    name: 'Mobile app', programme: 'Digital', team: 'App team',
    csv: [HEAD,
      'Spec,Done,20,20,100,2026-01-05,2026-01-08',
      'API,In Progress,60,40,70,2026-01-12,2026-01-23',
      'UI,In Progress,50,25,50,2026-01-12,2026-01-30',
      'QA,To Do,20,0,0,2026-02-02,2026-02-06',
      'Docs,In Progress,10,5,50,2026-01-19,2026-01-23',
      'Setup,Done,8,8,100,2026-01-05,2026-01-06'].join('\n'),
  },
  {
    name: 'Data platform', programme: 'Data', team: 'Data team',
    csv: [HEAD,
      'Model,Done,40,50,100,2026-01-05,2026-01-09',
      'Pipeline,In Progress,60,40,50,2026-01-12,2026-01-23',
      'Report,To Do,20,0,0,2026-01-26,2026-01-30'].join('\n'),
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
