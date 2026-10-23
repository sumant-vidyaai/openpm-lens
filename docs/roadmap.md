# Roadmap: batches from v0.19 to v1.5

Status: proposed 2026-10-16, replaces the earlier Batch B to F list. Detail of each area is in `lifecycle-map.md`.

**Progress:** Batch 1 (v0.19), Batch 2 (v0.20) and Batch 3 (v0.21, snapshots and trends) Batch 4 (v0.22, finish-date forecast and status report) and Batch 5 (v0.23, look, dashboard and trust) are built. Batch 1 shipped without the milestone forecast (moved to Batch 4) and with holidays as a Holidays sheet; Batch 2 shipped as the Risks, Issues and Changes sheets plus a tab and Overview panel.

## How every batch is run (same each time)
1. Build the feature; add tests with hand-worked numbers.
2. Check every new formula against an independent source (web) and an independent calculation outside the app.
3. Test in the browser with the filled example workbook (extended each batch), in two time zones, light and dark, at phone width; axe-core accessibility scan.
4. Update the Learn section (a card with a worked example for each new measure), the user guide, the decisions log and the Project docs.
5. Send the zip. You test, then say "go" for the next batch.
Each batch adds only optional template sheets or columns; old files keep working.

## Before v1.0 (user tasks, step by step)
CI check on GitHub, trademark search for the name, confirm that Vidyaai owns the work, send one real Microsoft Project XML file, final live test with a real export, and the phone problem (screenshot of the phone and the Cloudflare Pages Deployments page).

## Up to v1.0: delivery and control

| Batch | Version | Name | Contents | New template parts |
|---|---|---|---|---|
| 1 | v0.19 | Explain and accuracy | "Why is it red?" list of tasks that hurt CPI and SPI most; actual-cost line on the earned-value chart and a monthly cash-flow view; holidays and leave list; milestones (planned vs forecast, slip); data-quality score with "fix these first" | Settings: holiday list; Tasks: Milestone type used |
| 2 | v0.20 | Risks, issues and changes | Risk register (probability x impact = exposure, owner, response, overdue actions, heat map); issue log with age; change log (approved cost and schedule impact, running total, scope growth %); a RAID panel on Overview | Sheets: Risks, Issues, Changes |
| 3 | v0.21 | Snapshots and trends | Save a snapshot on this device and as a downloadable file; mark one as the baseline; compare two dates; trends of CPI, SPI, throughput, open defects; burndown, burnup, cumulative flow; days since last update | none (snapshot files) |
| 4 | v0.22 | Forecast and report | Finish-date forecast (50/85/95%) from past throughput, and milestone forecast; one-page status report with plain-language commentary, printable | none |
| 5 | v0.23 | Look, dashboard, trust | Redesign part 2 (status strip per project, progress bars, first-run screen with sample preview, accent colour); interactive dashboard (filters by project / programme / team / date, click a chart to filter, hover details, trend panels); sidebar regrouped by lifecycle; contribution guide; automatic check that every metric definition matches its Learn card; regional date and number formats | none |

**v1.0 = after Batch 5** and the pre-v1.0 user tasks above.

## After v1.0

| Batch | Version | Name | Contents | New template parts |
|---|---|---|---|---|
| 6 | v1.1 | Planning | Three-point estimates; task dependencies, critical path and float (from Project XML links, or a "Depends on" column); contingency and management reserve; baseline lock | Tasks: Optimistic (h), Pessimistic (h), Depends on; Settings: reserve |
| 7 | v1.2 | Initiate: RFI, RFP, business case | RFI / RFP / RFQ tracker; vendor weighted scoring with a weights-sensitivity check; payback, ROI, benefit-cost ratio and net present value (discount rate entered by the user); stakeholder power / interest grid; go / no-go checklist | Sheets: Vendors, Business case, Stakeholders |
| 8 | v1.3 | Close, benefits, practice | Reusable checklist view (go-live, acceptance, contract closure); lessons-learned register; one-page closure report; benefits promised vs realised; export everything as one archive file; **Learn practice mode** (quizzes, a worked case study) | Sheets: Lessons, Benefits |
| 9 | v1.4 | Portfolio and PMO | Projects by phase (stage-gate view); demand vs capacity across projects; prioritisation scoring set by the PMO; risk heat map across projects; reporting discipline (who has not updated); portfolio data-quality view | Tasks / Projects: Phase column |
| 10 | v1.5 | Tools and connections | Adapters for tools whose real header lines are supplied; "paste your column names" helper; Trello JSON reader if wanted; optional live connections with tokens held in memory only | none |

## Standing decisions
- No formula is built from memory: each is confirmed from an independent source and shown with its working.
- Anything needing judgement (weights, discount rate, thresholds, reserve) is entered by the user, never defaulted; thresholds stay "starting values, not a standard".
- New modules are optional; a blank sheet is simply not shown as a result.
- Tool-specific adapters only from real header lines or documentation that states the column names.
