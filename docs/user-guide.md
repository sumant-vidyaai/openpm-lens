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
| Overview | Where does my project stand? One health status, CPI and SPI on a ruler, key numbers, "Why is it red?" (tasks pulling cost or schedule down) and "Fix these first" (shows what you loaded on Import) | Nothing extra; load a file on Import first |
| Import | Cost, schedule and forecast in hours: CPI, SPI, EAC, ETC, VAC, TCPI, earned schedule, data quality | Task name, planned hours, % complete; actual hours for cost; start and finish dates for schedule |
| Template | No project tool, or one the app cannot read yet? Download the Excel or CSV template (or the filled example), fill it in and upload it. The app sets itself up | Nothing: it is a download and instructions page |
| Portfolio | Which projects need attention? | One file per project (or one template file with a Project column); roll up by project, programme, team or all |
| Flow metrics | Throughput, cycle time, WIP, work item age | Dates work started and finished |
| Schedule | On-time rate, finish variance, overdue tasks, milestones (done, late, overdue, due soon) | Planned finish and actual finish dates |
| Cost in money | Cost in money and forecast, monthly cash flow (planned vs actual) | Hours plus hourly rates you type in |
| Resources | Weekly load and utilisation per person | Planned hours, dates and an assignee |
| Risks, issues, changes | Which risks matter most, which problems are open and how old, how much has been added to the plan | The Risks, Issues and Changes sheets of the template workbook (all optional) |
| Forecast | When will the open work be finished? What is the chance of hitting the planned date? | Actual finish dates, a status date; at least 4 full weeks of finished items |
| Status report | Can I hand my manager one page? | A status date; the other tabs add detail when their data is present |
| Snapshots and trends | Am I getting better or worse? What changed since the plan was approved? | Save a snapshot each time you update (needs a status date); at least two for trends |
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

## The fill-in template

On the **Template** tab, download the Excel workbook (or the plain CSV). Fill in the **Tasks** sheet, one row per task; use the **Settings** sheet for the status date and your own limits, and the **Rates** sheet for hourly rates. Upload it on **Import** (one project) or **Portfolio** (several: put the project name in the Project column).

Rules: effort in hours; % complete as 0 to 100; dates as year-month-day; a blank means "not known" and is never counted as 0. After upload the app shows, for each area, how many tasks have what it needs (for example "Cost: 12 of 40 tasks have actual hours"). Cancelled tasks are left out of every measure. Excel workbooks with a very large sheet (several thousand rows) cannot be read here; save that sheet as CSV.

Holidays and leave: list dates on the **Holidays** sheet and each person's days away on the **Leave** sheet (on Portfolio, type holidays in the box). They count only when days are counted as weekdays. The dashed actual-cost line and the cash flow spread each task's actual hours evenly over its dates; this is an assumption, stated on screen.

Risks, issues and changes: fill in the optional **Risks**, **Issues** and **Changes** sheets. Risk score = probability x impact (each 1 to 5); the Low, Medium and High limits (7 and 13) are starting values you can change on Settings. Scope growth needs "Original budget (h)" on Settings. Blank cells are "not known", never 0.

Snapshots and trends: after loading a file and choosing the status date, open **Snapshots and trends** and press **Save snapshot**. Do this at each update. A snapshot holds totals only (no task names). Mark one snapshot per project as the **baseline** (the plan to compare against). With two or more you get a comparison table and trend charts. Snapshots are kept in this browser on this device; use **Download all snapshots** to keep a copy, and **Add snapshot files** to bring them back or to load a colleague's.

Forecast: open **Forecast** after choosing the status date. It shows the items finished in each of the last 12 weeks (change the number of weeks if you wish) and the dates by which 50%, 85% and 95% of simulated futures finish. Use 85% to commit. Add **Extra items still to come** if scope will grow. Milestones are forecast too, on the stated assumption that the work behind a milestone is the open items planned to finish before it.

Status report: open **Status report**, add your own reasons, decisions needed and next steps in the boxes, then press **Download report (PDF)** and choose Save as PDF in the print window. What you type is not saved.

Report as PDF: on Snapshots and trends press **Download report (PDF, with charts)**. Your browser's print window opens; choose **Save as PDF** as the printer and save. The report holds the summary, the comparison table and all charts. For the numbers in Excel use **Download as spreadsheet (CSV)**.
