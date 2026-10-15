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
