# openpm-lens user guide

openpm-lens turns an export from your project tool into standard project numbers, with every number explained. It runs in your browser. Your file is read on your device and is never uploaded. There is no tracking.

## 1. Quick start

1. Open the app. The **Overview** screen opens first. Choose **Import** in the left menu (on a phone the menu runs along the top; swipe it sideways).
2. Choose your export file (CSV, Excel `.xlsx`, or Microsoft Project XML `.xml`), or press **Try the made-up example**.
3. Check the column guesses in step 1. Fix any that are wrong.
4. Choose a **status date** (the "as of" date). The app never assumes today.
5. Read the results. Open **Show the working** under any number to see each step.
6. Return to **Overview** for the one-screen summary: a health status in words, CPI and SPI shown on a ruler (red, amber and green zones; 1.0 is on plan) and the key numbers. Status never relies on colour alone.
7. Use **Download** or **Print or save as PDF** to share.

## 2. What each tab does

| Tab | Question it answers | What the file needs |
|---|---|---|
| Overview | Where does my project stand? One health status, CPI and SPI on a ruler, key numbers (shows what you loaded on Import) | Nothing extra; load a file on Import first |
| Import | Cost, schedule and forecast in hours: CPI, SPI, EAC, ETC, VAC, TCPI, earned schedule, data quality | Task name, planned hours, % complete; actual hours for cost; start and finish dates for schedule |
| Portfolio | Which projects need attention? | One file per project; roll up by project, programme, team or all |
| Flow metrics | Throughput, cycle time, WIP, work item age | Dates work started and finished |
| Schedule | On-time rate, finish variance, overdue tasks | Planned finish and actual finish dates |
| Cost in money | Cost in money and forecast | Hours plus hourly rates you type in |
| Resources | Weekly load and utilisation per person | Planned hours, dates and an assignee |
| Quality | Defects: counts, age, resolution time, severity, removal efficiency | Item type, created and resolved dates |
| Learn | What a term means; which metric answers which question | Nothing |
| Tool coverage | Which tools' exports contain what each metric needs | Nothing |
| Metric library | Each metric's formula and a worked example | Nothing |

Your Import choices (file, columns, status date) are shared with Schedule, Cost, Resources and Quality. Load the file once on Import.

## 3. Reading a Microsoft Project XML file

In Microsoft Project, save the plan as XML. The app reads it in your browser. Summary tasks are left out because their hours repeat their sub-tasks'. Planned work and dates come from baseline number 0; the app tells you so, because Microsoft's reference does not say what the baseline number means. Check this against your plan.

## 4. Rules the app follows

- **A missing value is never turned into zero.** Items that cannot be used are left out and listed, with the reason.
- **Roll-ups add hours first, then divide.** Ratios are never averaged.
- **Small samples are not dressed up.** Percentages, percentiles and health statuses need at least 5 items, otherwise they say "Insufficient data".
- **Unclear dates are refused**, not guessed (for example 03/04/2026 when the date order is not chosen).
- **Assumptions are on screen** next to the results and in downloads.
- **Colour limits are starting values, not a standard.** Change them in Portfolio.
- **Status never relies on colour alone.** Each status has a symbol and a word.

## 5. Downloads and printing

CSV downloads open in Excel. Text that starts with `=`, `+`, `-` or `@` is saved with a leading apostrophe so a spreadsheet cannot run it as a formula. Numbers are rounded to 4 decimal places in downloads, and a note says so. Use the browser's print dialog to save a page as PDF.

## 6. Privacy and offline use

- Files never leave your browser tab.
- Nothing is loaded from other websites. A security policy in the page blocks it.
- After the first visit the app works offline. Reload once while online after an update.
- Only your theme choice and the app's own files (for offline use) are kept on your device. Your project data is not kept.

## 7. Accessibility

- Works with a keyboard: Tab to move, Enter or Space to press. A "Skip to content" link appears first.
- Light, dark and system themes (Theme box at the bottom of the left menu).
- Charts have a text description, hover text and a **Show as table** view.
- Checked with the axe automated tool on every tab in both themes (no problems found) and at a 360 px phone width. Automated tools find only part of the problems; an independent review with real assistive technology is still advisable.

## 8. Known limits

- Percent complete is a judgement; if it is optimistic, every earned-value number is too.
- Jira's standard CSV has no "work started" date, so cycle time needs a date column you supply.
- A task assigned to several people is left out of the Resources and Cost splits.
- The Portfolio tab cannot map columns per file; use Import for unusual files.
- The Flow tab reads CSV and Excel, not Project XML.
- Charts do not yet include an actual-cost line.
- Column names for tools other than those listed under Tool coverage have not been checked against real exports.

## 9. Checking a release

Each release has `SHA256SUMS.txt`, a CycloneDX software bill of materials (`sbom.cdx.json`) and `THIRD_PARTY_NOTICES.txt`. To check a download: `sha256sum -c SHA256SUMS.txt` (Windows PowerShell: `Get-FileHash <file>` and compare).
