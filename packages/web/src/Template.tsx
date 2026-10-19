import { TEMPLATE_COLUMNS, type TemplateColumn, type TemplateReadiness } from '@openpm-lens/core';

const BASE = import.meta.env.BASE_URL;
const FILES = [
  { href: `${BASE}templates/openpm-lens-template.xlsx`, label: 'Excel template (recommended)', note: 'Dropdowns, instructions, Settings and Rates sheets.' },
  { href: `${BASE}templates/openpm-lens-template.csv`, label: 'CSV template', note: 'Just the column headings, for any spreadsheet or tool.' },
  { href: `${BASE}templates/openpm-lens-example.xlsx`, label: 'Filled example (Excel)', note: 'Two made-up projects. Upload it to see every screen working.' },
  { href: `${BASE}templates/openpm-lens-example.csv`, label: 'Filled example (CSV)', note: 'The same made-up data as a plain CSV.' },
];

const HELP: Record<TemplateColumn, [string, string]> = {
  Project: ['Optional', 'Name of the project. Fill it in to see several projects side by side on the Portfolio tab.'],
  Programme: ['Optional', 'The programme the project belongs to.'],
  Team: ['Optional', 'The team that owns the project.'],
  ID: ['Recommended', 'A short unique reference such as T-1.'],
  Task: ['Required', 'What the task is called.'],
  Type: ['Quality', 'Pick from the list. Tasks of type Bug are counted as defects.'],
  Status: ['Required', 'Not started, In progress, Done or Cancelled.'],
  Assignee: ['Resources, Cost in money', 'Who does the work. Separate several people with a semicolon (;).'],
  'Planned start': ['Schedule', 'Year-month-day, for example 2026-03-02. The plan.'],
  'Planned finish': ['Schedule', 'Year-month-day. The plan.'],
  'Actual start': ['Flow', 'The day work really began. Blank if not begun.'],
  'Actual finish': ['Flow', 'The day work really finished. Blank if not finished.'],
  'Estimate (h)': ['Cost, Schedule', 'Planned effort in hours. Blank means no estimate (not 0).'],
  'Actual (h)': ['Cost', 'Hours spent so far. 0 means none spent; blank means not recorded.'],
  '% complete': ['Cost, Schedule', '0 to 100 (write 40, not 40%). Done tasks should be 100.'],
  Created: ['Quality', 'The day an item was raised. Year-month-day.'],
  Severity: ['Quality', 'Critical, High, Medium or Low.'],
  'Found in': ['Quality', 'Where a bug was found, such as Testing or Production.'],
};

/** How many tasks have what each part of the app needs. */
export function Readiness({ readiness }: { readiness: TemplateReadiness }) {
  if (readiness.total === 0) return <p className="note">The Tasks sheet has no rows yet. Fill in some tasks and upload it again.</p>;
  return (
    <div className="readiness">
      <h4>What is ready to work out</h4>
      <ul className="plain">
        {readiness.checks.map((c) => {
          const full = c.ready === readiness.total && readiness.total > 0;
          return (
            <li key={c.metric}>
              <span>
                <strong>{c.metric}</strong>: {c.ready} of {readiness.total} tasks have what is needed
                {full ? ' ✓' : ` (needs ${c.needs})`}
              </span>
              <progress value={c.ready} max={Math.max(1, readiness.total)} aria-label={`${c.metric}: ${c.ready} of ${readiness.total} tasks ready`} />
            </li>
          );
        })}
      </ul>
      <p className="note">A blank cell is never treated as 0.{readiness.cancelled > 0 ? ` ${readiness.cancelled} cancelled task${readiness.cancelled === 1 ? ' is' : 's are'} not counted.` : ''} Tasks without what a measure needs are left out of that measure only, and listed.</p>
    </div>
  );
}

export function TemplateScreen({ onGoImport }: { onGoImport: () => void }) {
  return (
    <section aria-labelledby="tpl-h">
      <h2 id="tpl-h">Fill-in template</h2>
      <p className="lead">
        No project tool, or a tool we do not read yet? Fill in this template and upload it. The app recognises it and sets itself up, with no column questions.
        Your file stays in your browser and is never uploaded.
      </p>
      <h3>1. Download</h3>
      <ul className="downloads">
        {FILES.map((f) => (
          <li key={f.href}>
            <a className="btn" href={f.href} download>{f.label}</a> <span className="note">{f.note}</span>
          </li>
        ))}
      </ul>
      <h3>2. Fill in what you have</h3>
      <ol>
        <li>One row per task on the <strong>Tasks</strong> sheet. Leave the headings in row 1 alone.</li>
        <li>Effort is in <strong>hours</strong>, percent is <strong>0 to 100</strong>, dates are <strong>year-month-day</strong>.</li>
        <li>On the <strong>Settings</strong> sheet, type the status date (the &ldquo;as of&rdquo; day). It is never assumed.</li>
        <li>Optional: put each person&rsquo;s hourly rate on the <strong>Rates</strong> sheet to see cost in money.</li>
        <li>Optional: list company holidays on the <strong>Holidays</strong> sheet and days away on the <strong>Leave</strong> sheet. Holidays are left out of weekday counts; leave takes one fifth off that person&rsquo;s weekly capacity per day.</li>
        <li>To mark a milestone, set its Type to Milestone.</li>
        <li>A blank cell means &ldquo;not known&rdquo;. It is never counted as 0.</li>
      </ol>
      <h3>3. Upload</h3>
      <p>Use <button type="button" onClick={onGoImport}>Import</button> for one project, or Portfolio for several: put the project name in the Project column and one file can hold them all.</p>
      <h3>The columns</h3>
      <div className="scroll" tabIndex={0}>
        <table>
          <caption className="sr">Template columns</caption>
          <thead><tr><th scope="col">Column</th><th scope="col">Needed for</th><th scope="col">What to put there</th></tr></thead>
          <tbody>
            {TEMPLATE_COLUMNS.map((c) => (
              <tr key={c}><th scope="row">{c}</th><td>{HELP[c][0]}</td><td>{HELP[c][1]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
