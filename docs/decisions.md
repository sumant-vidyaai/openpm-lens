# Decisions and roadmap

Decisions agreed with the project owner on 15 October 2026.

## Decisions

| Topic | Decision |
|---|---|
| Licence | Apache-2.0 (explicit patent grant, clear contributor terms). |
| Hosting | Cloudflare Pages free plan (static files; no project data ever reaches the host). Indian mirror optional later. |
| Blocked browsers | Tools that block direct browser calls (e.g. Jira Cloud) are file-import only in v1. No hosted proxy, because it would break "no data to any server". |
| Live API connectors | Only where the tool allows browser calls (e.g. Azure DevOps). Optional and clearly marked; tokens in memory only. |
| Metric grouping | Two neutral tags per card: `domain` (broad group) and `area` (traditional group). No third-party framework names or trademarks. |
| Sample data | Synthetic only, imitating each tool's export format. From the owner's PPM exports, column headers only, never rows. |
| Missing planned hours | Default "exclude and flag". Optional "treat as zero" with the assumption flagged. Missing actual hours or percent complete always exclude. |
| Percent complete | Visible per-tool setting (tool-reported, 0/100, 50/50, status-based). |
| Stack | TypeScript, Vite, React, Vitest; static site on Cloudflare Pages; offline support via service worker; GitHub Actions for tests. |
| Privacy rules | No tracking or analytics; nothing loaded from other websites at runtime; strict browser security policy; downloadable release bundle with checksum; dependency list kept small. |

## Connector order (proposed)

1. Generic CSV/XLSX importer with column mapping.
2. MS Project XML (MSPDI).
3. Jira CSV.
4. Azure DevOps (CSV, then browser REST).
5. Flow-focused tools (Linear, GitHub Projects, Trello, ClickUp).
6. Enterprise PPM (Clarity, Workfront, ServiceNow, Planview, Smartsheet).

## Status

- [x] v0.1 foundation: licence, README, contributing, security, canonical model types,
      adapter interface types, EVM formula library, percent-complete rules, safe unit
      parsing, missing-data aggregation, six metric recipe cards, 80 automated tests.
- [ ] Synthetic sample exports (Jira, Azure DevOps, MS Project style).
- [x] Web app shell (Vite + React) with light/dark mode, strict security policy, offline service worker and a metric library page (`packages/web`).
- [x] CSV importer with mapping screen, unit/percent/status choices and EV/AC/CPI/CV results (v0.3). Excel (.xlsx) reading added in v0.4 with `read-excel-file` (MIT; its dependencies saxen, fflate, worker-f and unzipper-esm are also MIT; `npm audit` found no known vulnerabilities). Rejected: `xlsx` from npm (stale 0.18.5) and `exceljs` (large, many dependencies). Old `.xls` files are not supported.
- [x] Jira CSV adapter (v0.5): recognises the export by column names, reads seconds, skips the Σ parent-total columns, has no % complete so uses a status-based rule (0/100 by default). Built from Atlassian documentation (Original Estimate is exported in seconds); column names still to be confirmed against a real export header line. Added in v0.6 (same approach, notes on screen say what is verified): Azure DevOps, Linear, ClickUp, Workfront, Microsoft Project table export (CSV/Excel). Verified against vendor documentation: Jira time in seconds; Azure DevOps export uses display names; Linear has no time-spent field and its Estimate is in points; ClickUp lists Time Estimated/Time Spent but documents no unit (user must choose, nothing is guessed); Workfront stores Planned Hours in minutes. Not verified: Microsoft Project column names (standard field names, source search returned nothing usable) and Azure DevOps effort units. Still to do: MS Project XML (MSPDI), Smartsheet, Trello, GitHub Projects, Clarity, ServiceNow, Planview. Each should be checked against a real header line from a user.
- [x] v0.7: data-quality score (usable tasks / all tasks; withheld under 5 tasks as "Insufficient data"; bands are starting values, not a standard), per-input completeness table, reading-problem counts, and a Tool coverage matrix built from the adapters (Yes / No / Check). Dashboard uses plain tiles, native meter and text tables, never colour alone. v0.8: planned start/finish dates, a user-chosen status date (never assumed), planned value, SPI and SV. Dates like 03/04/2026 are refused unless the user says day/month or month/day (ISO and month-name dates are always read). Planned value spreads planned hours evenly over weekdays (or calendar days, user choice), shown as a visible assumption; tasks lacking planned hours, progress or valid dates are excluded and listed; actual hours are not needed. Date column names per tool are NOT verified from documentation (flagged on screen and as "Check" in the coverage matrix). v0.9: "Show the working" panels under the cost and schedule results: assumptions in force, each formula with the real numbers, and a task-by-task table (capped at 200 rows on screen; totals use all rows). Tests prove the table sums to the headline numbers. [ ] Still to do: earned schedule, flow metrics (cycle time, throughput), MS Project XML, more adapters, export of results.
- [ ] More metrics: earned schedule, schedule (critical path, PERT), cost, risk, quality,
      resource, agile/flow, Monte Carlo.
- [ ] Documentation site; publish via GitHub and Cloudflare Pages.

## Open items

- Review the `domain` and `area` tag chosen for each metric.
- Choose and licence-check the spreadsheet-reading and charting libraries.
- Project name chosen: openpm-lens. Check for name clashes before wider promotion; consider trademark registration later.
- Confirm copyright holder wording in `NOTICE`.

## v0.10 – Share it (Batch 1)
- Download summary (CSV) and task detail (CSV); print/save as PDF with the working. Text cells starting with = + - @ are prefixed with an apostrophe (spreadsheet formula-injection defence). Values rounded to 4 d.p. in files, noted in the file.
- `packages/web/public/_headers`: CSP (adds frame-ancestors 'none'), nosniff, no-referrer, Permissions-Policy, COOP, no-cache for /sw.js and index.html. Cannot be verified locally; check in the browser dev tools on the live site.
- `.github/workflows/ci.yml`: Node 22, install, test, typecheck, build, audit (high). Must be created via GitHub web UI (dotfolders are skipped by drag-and-drop upload).
- Open: link GitHub to Claude (Settings -> Connectors) to allow direct pushes.

## v0.11 – Portfolio view (Batch 2)
- New Portfolio tab: load several files at once (one per project, first sheet of a workbook), name each project and type its programme and team; roll up by project, programme, team or whole portfolio.
- Roll-up rule: add the hours first (EV, AC, PV), then work out CPI/SPI from the totals. Ratios are never averaged. Projects with no usable number for a figure are left out of that figure and counted in a visible "Left out" column.
- Health (RAG): each of CPI and SPI is green at or above 0.95, amber at or above 0.85, red below. Overall = the worst index that can be used. An index needs at least 5 tasks behind it, otherwise the status is "Insufficient data" (never a guessed colour). All three limits are editable on screen and flagged "starting values, not a standard"; invalid edits are not applied and the starting values show with a message. Status is shown with a symbol and words, not colour alone.
- Roll-ups include projects whose own status is "Insufficient data"; this is stated on screen.
- Per-file settings are recognised-tool defaults; a tool with no documented unit stops until the user chooses one; generic files are read as hours and say so on screen.
- Fix: columns a recognised tool does not cover are filled in from generic header wording (`mergeMapping`), also used in the Import tab. Found when a plain file with "Planned hours / Actual hours" headers was recognised as Workfront and lost its Task column.
- Wording: tasks with unclear dates are reported as "no usable planned dates (missing or unclear)".
- Roll-up CSV: values rounded to 4 d.p. with a note. 156 tests pass.
- Open: portfolio does not yet let the user map columns per file (use the Import tab for odd files); status/percent rules per file use the tool's suggestion.

## v0.12 – More metrics (Batch 3)
**Forecast (Import tab):** EAC, ETC, VAC and TCPI. The user chooses how the rest of the work is expected to go (three EAC methods: BAC/CPI; AC + BAC - EV; AC + (BAC - EV)/(CPI x SPI)); the choice is shown. BAC = planned hours of the tasks used, not necessarily the whole project (stated on screen). TCPI is withheld with a reason when spend already equals or exceeds the budget (or forecast). The CPI x SPI method needs a status date. Included in the summary CSV.
**Earned schedule (Import tab):** ES = C + (EV - PV_C)/(PV_C+1 - PV_C); SV(t) = ES - AT; SPI(t) = ES/AT. Formulas checked against Walt Lipke's introduction at earnedschedule.com (the source gives no rule for after the planned end). Our rules, stated on screen: AT counts counted days (weekdays or calendar days) from the first planned start to the status date, both included, and keeps counting after the planned end; if all planned work is earned, ES is capped at the planned duration. The curve uses only tasks usable for schedule measures; a test checks the curve matches PV at the status date. Verified against an independent Python calculation (ES 8.7143, AT 13, SPI(t) 0.6703 for the Website redesign sample).
**Flow metrics (new tab):** WIP, throughput, cycle time, work item age. Definitions follow the Kanban Guide (prokanban.org): WIP = started not finished; throughput = finished per unit time; cycle time = started to finished; age = started to now. The guide does not say how to count days or which percentile method, so our rules (on screen): calendar days counted inclusively (same day = 1); nearest-rank percentiles, shown only with at least 5 finished items else "Insufficient data"; window = last N blocks of 7 days ending on the status date (not calendar weeks). Status date is required, never assumed. "Created" is never guessed as a start date (it would be lead time; warned if chosen). Left out and listed: cancelled, unclear dates, marked done without a done date, done before start, no dates, starts after status date. Finished items without a start count in throughput only. Every item is accounted for exactly once (test).
- Tests: 190 pass. Open: flow metrics need real header lines from Jira/Azure DevOps/etc. to suggest start/done columns; Jira's standard CSV has no "work started" date (needs changelog), so users must supply one.

## v0.13 – Batch 3b part 1: Schedule, Cost in money, Resources (inserted before Batch 4, agreed with the user)
**Why:** the app covered cost and schedule in hours and flow, but not resource, quality or cost in money. Plan agreed: Batch 3b before Batch 4, in two deliveries (v0.13: schedule extras, money, resources; v0.14: quality, charts, MS Project XML).
**Architecture:** the Import tab now publishes its worked-out data (table, items, hours tasks, schedule tasks, status date, date order, day count) to the other tabs (`SharedData`); rows line up one-to-one. New tabs reuse the Import tab's column and unit choices and add only their own picks. All tabs stay mounted (hidden) so loaded files and settings survive tab changes (previously the Import tab lost its file when you left it).
**Schedule tab:** variance = actual finish - planned finish in calendar days (positive late); on time = on or before planned finish; overdue = open task whose planned finish is before the status date. On-time % and median need at least 5 finished tasks (else "Insufficient data"). Left out and listed: cancelled, unclear dates, no planned finish, marked done without a finish date. Every task is counted exactly once (test).
**Cost in money tab:** hours x hourly rates entered by the user (default rate and/or per person); one currency, label only, no conversion or lookup; invalid rates ignored; a task without any applicable rate is left out and listed (never a guessed rate). Same task rules as hours. A task naming several people (";" separated; commas are read as part of one name) uses the default rate only if none of them has an own rate, else it is left out. Money CPI can differ from hours CPI (stated). Forecast in money offers the two methods that need no planned value.
**Resources tab:** planned hours spread evenly over planned weekdays (or calendar days, from the Import setting), summed per person per week (weeks start Monday); utilisation = load / weekly capacity (default 40 h, editable, own capacity per person); weeks above a user-set limit (default 100%) are flagged with a symbol. Tasks naming several people are left out (split unknown); unassigned work has its own row. Planned vs actual per person uses tasks that have both. Capped at 104 weeks shown. Rules are this app's own arithmetic, not a standard.
**Verified:** all three checked against independent Python calculations on a made-up team file (60% on time, EV 6,240, AC 6,530, BAC 9,300, weekly utilisation per person). 207 tests pass.
**Open / known limits:** CSV exports from MS Project may include summary (parent) rows whose hours repeat their children's, which would double count; to be handled with the MS Project XML importer (which flags summary tasks) in v0.14. Assignee, type and severity columns are not yet in the Tool coverage matrix.
