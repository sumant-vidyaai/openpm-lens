#!/usr/bin/env python3
"""Builds the Spashta fill-in template (Excel + CSV) and a made-up example.

Run:  python3 scripts/make_template.py
Output: packages/web/public/templates/
Column names MUST match packages/core/src/template.ts (TEMPLATE_COLUMNS) -- a test checks this.
"""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

OUT = os.path.join(os.path.dirname(__file__), '..', 'packages', 'web', 'public', 'templates')
COLUMNS = ['Project', 'Programme', 'Team', 'ID', 'Task', 'Type', 'Status', 'Assignee',
           'Planned start', 'Planned finish', 'Actual start', 'Actual finish',
           'Estimate (h)', 'Actual (h)', '% complete', 'Created', 'Severity', 'Found in',
           'Optimistic (h)', 'Pessimistic (h)', 'Depends on']
DATE_COLS = ['Planned start', 'Planned finish', 'Actual start', 'Actual finish', 'Created']
STATUSES = ['Not started', 'In progress', 'Done', 'Cancelled']
TYPES = ['Task', 'Bug', 'Story', 'Milestone', 'Risk', 'Change']
SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
RULES = ['Use the % complete column', '0/100', '50/50', 'Status-based']
DAYS = ['Weekdays', 'All days']

HELP = {
    'Project': ('Optional', 'Name of the project. Fill it in to see several projects side by side on the Portfolio tab.'),
    'Programme': ('Optional', 'The programme the project belongs to (used to group projects).'),
    'Team': ('Optional', 'The team that owns the project.'),
    'ID': ('Recommended', 'A short unique reference such as T-1. Used to point at a task when something needs fixing.'),
    'Task': ('Required', 'What the task is called.'),
    'Type': ('Optional', 'Pick from the list. Needed for the Quality tab: tasks of type Bug are counted as defects.'),
    'Status': ('Required', 'Pick from the list: Not started, In progress, Done or Cancelled.'),
    'Assignee': ('Optional', 'Who does the work. Needed for Resources and Cost in money. Separate several people with a semicolon (;).'),
    'Planned start': ('For schedule', 'Year-month-day, for example 2026-03-02. The plan, not what happened.'),
    'Planned finish': ('For schedule', 'Year-month-day. The plan, not what happened.'),
    'Actual start': ('For flow', 'The day work really began. Leave blank if it has not begun.'),
    'Actual finish': ('For flow', 'The day work really finished. Leave blank if it is not finished.'),
    'Estimate (h)': ('For cost and schedule', 'Planned effort in HOURS. Plain number. Leave blank if there is no estimate (blank is not the same as 0).'),
    'Actual (h)': ('For cost', 'Hours really spent so far. Plain number. 0 means "none spent"; blank means "not recorded".'),
    '% complete': ('For cost and schedule', 'A number from 0 to 100 (write 40, not 40%). Done tasks should be 100.'),
    'Created': ('For quality', 'The day the item was raised. Year-month-day.'),
    'Severity': ('Optional', 'For bugs: Critical, High, Medium or Low.'),
    'Found in': ('Optional', 'Where a bug was found, such as Testing or Production. Lets the Quality tab count problems found after release.'),
    'Optimistic (h)': ('For Planning', 'Best-case effort in HOURS if things go well. Used with Estimate (h) as the most likely value and Pessimistic (h). Leave blank if unknown.'),
    'Pessimistic (h)': ('For Planning', 'Worst-case effort in HOURS if things go badly. Must be at least the Estimate (h). Leave blank if unknown.'),
    'Depends on': ('For Planning', 'IDs of tasks that must FINISH before this one starts, separated by a comma, for example W-1, W-2. Finish-to-start only; no lags.'),
}

# A made-up example. Every number is invented.
EXAMPLE = [
    # Project, Programme, Team, ID, Task, Type, Status, Assignee, PS, PF, AS, AF, Est, Act, Pct, Created, Sev, Found, Opt, Pess, Depends
    ['Website relaunch', 'Digital', 'Web', 'W-1', 'Requirements', 'Task', 'Done', 'Asha', '2026-03-02', '2026-03-06', '2026-03-02', '2026-03-06', 40, 44, 100, '', '', '', 32, 56, ''],
    ['Website relaunch', 'Digital', 'Web', 'W-2', 'Design mock-ups', 'Task', 'Done', 'Ravi', '2026-03-09', '2026-03-13', '2026-03-09', '2026-03-16', 40, 52, 100, '', '', '', 32, 64, 'W-1'],
    ['Website relaunch', 'Digital', 'Web', 'W-3', 'Build pages', 'Story', 'In progress', 'Asha', '2026-03-16', '2026-04-03', '2026-03-17', '', 80, 56, 60, '', '', '', 64, 120, 'W-2'],
    ['Website relaunch', 'Digital', 'Web', 'W-4', 'Build search', 'Story', 'In progress', 'Meena', '2026-03-16', '2026-03-27', '2026-03-18', '', 48, 30, 50, '', '', '', 36, 72, 'W-2'],
    ['Website relaunch', 'Digital', 'Web', 'W-5', 'Content migration', 'Task', 'Not started', 'Ravi', '2026-04-06', '2026-04-17', '', '', 60, 0, 0, '', '', '', 48, 96, 'W-3, W-4'],
    ['Website relaunch', 'Digital', 'Web', 'W-6', 'Broken contact form', 'Bug', 'Done', 'Meena', '', '', '2026-03-10', '2026-03-12', 8, 6, 100, '2026-03-09', 'High', 'Testing', '', '', ''],
    ['Website relaunch', 'Digital', 'Web', 'W-7', 'Logo blurry on phones', 'Bug', 'In progress', 'Asha', '', '', '2026-03-24', '', 4, 2, 50, '2026-03-23', 'Low', 'Production', '', '', ''],
    ['Website relaunch', 'Digital', 'Web', 'W-8', 'Launch', 'Milestone', 'Not started', 'Asha', '2026-04-20', '2026-04-20', '', '', 8, 0, 0, '', '', '', '', '', 'W-5'],
    ['Mobile app', 'Digital', 'Apps', 'M-1', 'Login screen', 'Story', 'Done', 'Dev', '2026-03-02', '2026-03-13', '2026-03-02', '2026-03-12', 60, 54, 100, '', '', '', 48, 84, ''],
    ['Mobile app', 'Digital', 'Apps', 'M-2', 'Profile screen', 'Story', 'Done', 'Dev', '2026-03-09', '2026-03-20', '2026-03-13', '2026-03-24', 50, 62, 100, '', '', '', 40, 80, ''],
    ['Mobile app', 'Digital', 'Apps', 'M-3', 'Payments', 'Story', 'In progress', 'Kiran', '2026-03-16', '2026-04-10', '2026-03-16', '', 120, 70, 40, '', '', '', 90, 180, 'M-2'],
    ['Mobile app', 'Digital', 'Apps', 'M-4', 'Crash on start', 'Bug', 'Done', 'Kiran', '', '', '2026-03-20', '2026-03-21', 6, 9, 100, '2026-03-19', 'Critical', 'Production', '', '', ''],
    ['Mobile app', 'Digital', 'Apps', 'M-5', 'Notifications', 'Story', 'Not started', 'Dev', '2026-04-06', '2026-04-24', '', '', 70, 0, 0, '', '', '', 56, 110, 'M-2'],
    ['Mobile app', 'Digital', 'Apps', 'M-6', 'Store listing', 'Task', 'Cancelled', 'Kiran', '2026-03-30', '2026-04-03', '', '', 16, 0, 0, '', '', '', '', '', ''],
]
EXAMPLE_SETTINGS = {'Status date': '2026-03-31', 'Currency': 'INR', 'Default hourly rate': 40}
EXAMPLE_HOLIDAYS = [('2026-03-25', 'Festival day (made up)')]
EXAMPLE_LEAVE = [('Kiran', '2026-03-30', '2026-04-03')]
EXAMPLE_SETTINGS['Original budget (h)'] = 540
EXAMPLE_SETTINGS['Contingency reserve (h)'] = 60
EXAMPLE_SETTINGS['Management reserve (h)'] = 40
EXAMPLE_SETTINGS['Discount rate (%)'] = 8
EXAMPLE_SETTINGS['Stakeholder high from'] = 4
EXAMPLE_SETTINGS['Phase order'] = 'Idea, Plan, Build, Test, Launch'
EXAMPLE_SETTINGS['Update due every (days)'] = 14
PROJ_HEAD = ['Project', 'Phase', 'Project manager', 'Last updated', 'Next gate']
EXAMPLE_PROJ = [
    ['Website relaunch', 'Build', 'Asha', '2026-03-27', '2026-04-10'],
    ['Mobile app', 'Build', 'Kiran', '2026-03-10', '2026-03-27'],
    ['Data warehouse (made up)', 'Idea', 'Ravi', '', '2026-05-15'],
]
EXAMPLE_GATE = [
    ['Business case approved (made up)', 'Asha', 'Yes', 'Signed off 2026-02-20'],
    ['Budget secured (made up)', 'Ravi', 'No', 'Waiting for the finance committee'],
    ['Team named (made up)', 'Meena', '', ''],
    ['Legal review (made up)', '', 'Not applicable', 'No contract at this stage'],
]
EXAMPLE_PRIORITY = [
    ['Project', 'Strategic fit', 'Value', 'Ease'],
    ['Weight', 5, 3, 2],
    ['Website relaunch', 3, 4, 4],
    ['Mobile app', 5, 4, 2],
    ['Data warehouse (made up)', 4, 5, 2],
]
EXAMPLE_SCORING = [
    ['Option', 'Price', 'Fit to needs', 'Support', 'Security'],
    ['Weight', 40, 30, 20, 10],
    ['Vendor A (made up)', 7, 9, 6, 8],
    ['Vendor B (made up)', 8, 6, 7, 7],
    ['Vendor C (made up)', 6, 8, 9, ''],
]
EXAMPLE_CASE = [[0, 50000, ''], [1, '', 20000], [2, '', 25000], [3, '', 15000]]
STAKE_HEAD = ['Name', 'Role', 'Power (1-5)', 'Interest (1-5)', 'Note']
EXAMPLE_STAKE = [
    ['Sponsor (made up)', 'Funds the project', 5, 5, 'Weekly catch-up'],
    ['Finance lead', 'Approves spend', 5, 2, 'Monthly summary'],
    ['Support team', 'Will run the service', 2, 5, 'Invite to demos'],
    ['Neighbouring team', 'Shares a server', 1, 2, ''],
]
SOL_HEAD = ['ID', 'Type', 'Vendor', 'Due', 'Received', 'Status']
EXAMPLE_SOL = [
    ['S-1', 'RFI', 'Vendor A (made up)', '2026-03-05', '2026-03-04', 'Answered'],
    ['S-2', 'RFP', 'Vendor B (made up)', '2026-03-20', '', 'Sent'],
    ['S-3', 'RFP', 'Vendor C (made up)', '2026-04-10', '', 'Sent'],
    ['S-4', 'RFQ', 'Vendor D (made up)', '2026-03-12', '', 'Sent'],
]
GO_HEAD = ['Decision', 'Decided by', 'Date', 'Reason']
EXAMPLE_GO = [['Go', 'Sponsor (made up)', '2026-02-28', '']]
BEN_HEAD = ['ID', 'Benefit', 'Owner', 'Measure', 'Planned', 'Realised', 'Due']
EXAMPLE_BEN = [
    ['B-1', 'Fewer support calls (made up)', 'Support lead', 'calls a month', 400, 340, '2026-09-30'],
    ['B-2', 'Faster order entry (made up)', 'Sales lead', 'hours saved a month', 120, 150, '2026-09-30'],
    ['B-3', 'Lower hosting cost (made up)', 'IT lead', 'cost saved a month', 900, '', '2026-12-31'],
]
CHECK_HEAD = ['Group', 'Item', 'Owner', 'Status', 'Done on']
EXAMPLE_CHECK = [
    ['Go-live', 'Release plan approved', 'Asha', 'Done', '2026-03-27'],
    ['Go-live', 'Support team briefed', 'Meena', 'Done', '2026-03-30'],
    ['Acceptance', 'All requirements confirmed as met', 'Asha', 'Done', '2026-03-31'],
    ['Acceptance', 'Deliverables handed over and signed off', 'Sponsor', 'Open', ''],
    ['Contract closure', 'Outstanding invoices paid', 'Finance', 'Open', ''],
    ['Contract closure', 'Vendor and contractor agreements closed', 'Ravi', 'Open', ''],
    ['Handover', 'Records archived', 'Ravi', 'Open', ''],
    ['Handover', 'Team released or reassigned', 'Asha', 'Not applicable', ''],
]
LESSON_HEAD = ['Category', 'Lesson', 'Recommendation', 'Owner', 'Raised']
EXAMPLE_LESSON = [
    ['Went well', 'Weekly demos caught misunderstandings early (made up)', 'Keep weekly demos on every project', 'Asha', '2026-03-20'],
    ['Went badly', 'The payment vendor delivered late (made up)', 'Agree a fallback before signing', 'Ravi', '2026-03-25'],
    ['Do differently', 'Estimates ignored testing effort (made up)', 'Add a testing line to every estimate', 'Meena', '2026-03-28'],
]
RISK_HEAD = ['ID', 'Risk', 'Probability (1-5)', 'Impact (1-5)', 'Owner', 'Response', 'Status', 'Action', 'Action due', 'Action done', 'Project']
ISSUE_HEAD = ['ID', 'Issue', 'Priority', 'Owner', 'Status', 'Raised', 'Due', 'Resolved']
CHANGE_HEAD = ['ID', 'Change', 'Requested by', 'Decision', 'Requested', 'Decided', 'Cost impact (h)', 'Schedule impact (days)']
EXAMPLE_RISKS = [
    ['R-1', 'Payment vendor delivers the API late', 4, 4, 'Asha', 'Mitigate', 'Open', 'Agree a fallback sandbox', '2026-03-20', '', 'Mobile app'],
    ['R-2', 'Key developer leaves', 2, 5, 'Ravi', 'Mitigate', 'Open', 'Cross-train a second person', '2026-04-10', '', 'Mobile app'],
    ['R-3', 'App store review takes longer than planned', 3, 3, 'Dev', 'Accept', 'Open', 'Submit two weeks early', '2026-03-25', '2026-03-24', 'Mobile app'],
    ['R-4', 'Test data is not available', 3, 2, '', '', 'Open', '', '', '', 'Website relaunch'],
    ['R-5', 'Design sign-off delayed', 4, 2, 'Meena', 'Avoid', 'Closed', 'Weekly review set up', '2026-03-05', '2026-03-04', 'Website relaunch'],
    ['R-6', 'Server capacity too small', 2, 4, 'Kiran', 'Mitigate', 'Occurred', 'See issue I-1', '', '', 'Data warehouse (made up)'],
]
EXAMPLE_ISSUES = [
    ['I-1', 'Staging server runs out of memory', 'High', 'Kiran', 'Open', '2026-03-01', '2026-03-20', ''],
    ['I-2', 'Report export is slow', 'Medium', 'Ravi', 'Open', '2026-03-21', '2026-04-07', ''],
    ['I-3', 'Login fails for some users', 'Critical', 'Asha', 'Resolved', '2026-03-01', '', '2026-03-05'],
    ['I-4', 'Wrong colour on button', 'Low', 'Meena', 'Closed', '2026-03-10', '', '2026-03-12'],
    ['I-5', 'Licence for design tool not yet bought', 'Medium', '', 'Open', '2026-03-24', '', ''],
]
EXAMPLE_CHANGES = [
    ['C-1', 'Add an export-to-Excel report', 'Sponsor', 'Approved', '2026-03-01', '2026-03-10', 40, 5],
    ['C-2', 'Extra field on sign-up form', 'Product owner', 'Approved', '2026-02-20', '2026-03-05', 14, 2],
    ['C-3', 'Drop the old reporting module', 'PM', 'Approved', '2026-03-12', '2026-03-20', -16, -2],
    ['C-4', 'Connect to the new data feed', 'Operations', 'Requested', '2026-03-15', '', 30, 3],
    ['C-5', 'Change the logo', 'Sponsor', 'Rejected', '2026-03-02', '2026-03-03', 10, 0],
]
EXAMPLE_RATES = [('Asha', 55), ('Ravi', 50), ('Meena', 45), ('Dev', 60), ('Kiran', 65)]

HEAD_FILL = PatternFill('solid', fgColor='0B6B73')
HEAD_FONT = Font(bold=True, color='FFFFFF')
INPUT_FILL = PatternFill('solid', fgColor='FFF8DC')
THIN = Side(style='thin', color='BBBBBB')


def build(path, example):
    wb = Workbook()
    # --- Start here
    s = wb.active
    s.title = 'Start here'
    lines = [
        ('Spashta template', 'title'),
        ('Fill in the Tasks sheet, optionally the Settings, Projects, Rates, Holidays, Leave, Risks, Issues, Changes, Scoring, Priority, Gate checklist, Business case, Stakeholders, RFI-RFP, Go-no-go, Checklist, Lessons and Benefits sheets, then upload this file to Spashta (Import or Portfolio tab). The app recognises it and sets itself up.', None),
        ('Your file stays on your computer: the app runs in your browser and sends nothing anywhere.', None),
        ('', None),
        ('Rules that matter', 'h'),
        ('1. One row per task. Do not rename, move or delete the column headings in row 1 of the Tasks sheet.', None),
        ('2. Effort is in HOURS, as plain numbers. Percent is 0 to 100.', None),
        ('3. Dates are year-month-day, for example 2026-03-31, typed as text so Excel will not change them.', None),
        ('4. A blank cell means "not known". It is never treated as 0. Type 0 only when you mean zero.', None),
        ('5. Fill only what you have. Each part of the app tells you what it still needs.', None),
        ('6. Yellow cells are for you to fill in. Cells with a small arrow have a list to pick from.', None),
        ('', None),
        ('The Tasks columns', 'h'),
    ]
    r = 1
    for text, kind in lines:
        c = s.cell(row=r, column=1, value=text)
        c.alignment = Alignment(wrap_text=True, vertical='top')
        if kind == 'title':
            c.font = Font(bold=True, size=16)
        elif kind == 'h':
            c.font = Font(bold=True, size=12)
        r += 1
    for j, h in enumerate(['Column', 'Needed for', 'What to put there'], start=1):
        c = s.cell(row=r, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
    r += 1
    for col in COLUMNS:
        need, what = HELP[col]
        s.cell(row=r, column=1, value=col).font = Font(bold=True)
        s.cell(row=r, column=2, value=need)
        w = s.cell(row=r, column=3, value=what)
        w.alignment = Alignment(wrap_text=True, vertical='top')
        r += 1
    s.column_dimensions['A'].width = 22
    s.column_dimensions['B'].width = 24
    s.column_dimensions['C'].width = 90
    for row in range(1, 14):
        s.merge_cells(start_row=row, start_column=1, end_row=row, end_column=3)
        if row in (2, 3, 6, 7, 8, 9, 10, 11):
            s.row_dimensions[row].height = 32 if row in (2, 6, 9, 10) else 18

    # --- Tasks
    t = wb.create_sheet('Tasks')
    for j, h in enumerate(COLUMNS, start=1):
        c = t.cell(row=1, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
        c.alignment = Alignment(wrap_text=True, vertical='center')
        t.column_dimensions[get_column_letter(j)].width = max(12, len(h) + 4)
    t.column_dimensions['E'].width = 30
    t.row_dimensions[1].height = 30
    t.freeze_panes = 'F2'
    MAXR = 2000
    STYLED = 500  # kept small: a sheet over ~512 KB unpacked would need a web worker, which the app's security policy blocks
    rows = EXAMPLE if example else []
    for i, row in enumerate(rows, start=2):
        for j, v in enumerate(row, start=1):
            if v != '':
                t.cell(row=i, column=j, value=v)
    for i in range(2, STYLED + 1):
        for j, h in enumerate(COLUMNS, start=1):
            c = t.cell(row=i, column=j)
            c.fill = INPUT_FILL
            if h in DATE_COLS or h in ('Project', 'Programme', 'Team', 'ID', 'Task', 'Assignee', 'Found in', 'Depends on'):
                c.number_format = '@'
    L = lambda h: get_column_letter(COLUMNS.index(h) + 1)

    def listval(h, values, title):
        dv = DataValidation(type='list', formula1='"' + ','.join(values) + '"', allow_blank=True, showErrorMessage=True,
                            errorTitle=title, error='Pick one from the list.')
        t.add_data_validation(dv)
        dv.add(f'{L(h)}2:{L(h)}{MAXR}')

    listval('Type', TYPES, 'Type')
    listval('Status', STATUSES, 'Status')
    listval('Severity', SEVERITIES, 'Severity')
    for h in DATE_COLS:
        col = L(h)
        dv = DataValidation(type='custom',
                            formula1=f'OR({col}2="",AND(LEN({col}2)=10,MID({col}2,5,1)="-",MID({col}2,8,1)="-",ISNUMBER(--LEFT({col}2,4)),ISNUMBER(--MID({col}2,6,2)),ISNUMBER(--RIGHT({col}2,2))))',
                            allow_blank=True, showErrorMessage=True, errorTitle='Date',
                            error='Write the date as year-month-day, for example 2026-03-31.')
        t.add_data_validation(dv)
        dv.add(f'{col}2:{col}{MAXR}')
    for h in ('Estimate (h)', 'Actual (h)', 'Optimistic (h)', 'Pessimistic (h)'):
        dv = DataValidation(type='decimal', operator='greaterThanOrEqual', formula1='0', allow_blank=True,
                            showErrorMessage=True, errorTitle='Hours', error='Enter hours as a plain number, 0 or more.')
        t.add_data_validation(dv)
        dv.add(f'{L(h)}2:{L(h)}{MAXR}')
    dv = DataValidation(type='decimal', operator='between', formula1='0', formula2='100', allow_blank=True,
                        showErrorMessage=True, errorTitle='% complete', error='Enter a number from 0 to 100 (write 40, not 40%).')
    t.add_data_validation(dv)
    dv.add(f'{L("% complete")}2:{L("% complete")}{MAXR}')

    # --- Settings
    g = wb.create_sheet('Settings')
    for j, h in enumerate(['Setting', 'Value', 'What it does'], start=1):
        c = g.cell(row=1, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
    settings = [
        ('Status date', '', 'The "as of" day for the report, year-month-day. Required for schedule, flow and quality. Never assumed.'),
        ('Hours per working day', 8, 'Used to turn days into hours and to spread planned work over days.'),
        ('Days counted', 'Weekdays', 'Weekdays (Mon-Fri; days on the Holidays sheet are skipped) or All days.'),
        ('Weekly capacity (h)', 40, 'Hours one person can work in a week, for the Resources tab.'),
        ('Currency', '', 'A label such as INR or USD. Optional; for the Cost in money tab.'),
        ('Default hourly rate', '', 'Rate used for people not listed on the Rates sheet. Optional.'),
        ('Green from', 0.95, 'CPI/SPI at or above this is Green. A starting value, not a standard.'),
        ('Amber from', 0.85, 'CPI/SPI at or above this (but below Green) is Amber; below is Red. A starting value, not a standard.'),
        ('Progress rule', RULES[0], 'How % complete is decided. The first choice uses the % complete column.'),
        ('In-progress credit (%)', 50, 'Only for the Status-based rule: % credited to tasks that are In progress.'),
        ('Original budget (h)', '', 'Hours in the plan before any approved change. Only used to show scope growth on the RAID tab. Optional.'),
        ('Risk medium from', 7, 'A risk score (probability x impact, 1 to 25) at or above this is Medium. A starting value, not a standard.'),
        ('Risk high from', 13, 'A risk score at or above this is High. A starting value, not a standard.'),
        ('Contingency reserve (h)', '', 'Hours held INSIDE the cost baseline for known risks (the project manager controls it). Enter your own figure; 0 is allowed. Optional, for the Planning tab.'),
        ('Management reserve (h)', '', 'Hours held ABOVE the cost baseline for unknown risks (the sponsor controls it). Enter your own figure; 0 is allowed. Optional, for the Planning tab.'),
        ('Discount rate (%)', '', 'Yearly rate used to bring future money back to today\'s value in the Initiate business case (write 8 for 8%). Your own figure; 0 is allowed. Optional.'),
        ('Stakeholder high from', '', 'Score (2 to 5) at or above which power or interest counts as "high" on the stakeholder grid. Your own figure. Optional.'),
        ('Phase order', '', 'Your project phases in order, separated by commas (for example Idea, Plan, Build, Test, Launch). Used by the stage-gate view on the Portfolio tab. Your own list. Optional.'),
        ('Update due every (days)', '', 'A project is "overdue for an update" when its Last updated date is MORE than this many days before the status date. Your own figure. Optional; without it nothing is called overdue.'),
    ]
    for i, (k, v, d) in enumerate(settings, start=2):
        if example and k in EXAMPLE_SETTINGS:
            v = EXAMPLE_SETTINGS[k]
        g.cell(row=i, column=1, value=k).font = Font(bold=True)
        c = g.cell(row=i, column=2, value=v if v != '' else None)
        c.fill = INPUT_FILL
        if k == 'Status date':
            c.number_format = '@'
        g.cell(row=i, column=3, value=d).alignment = Alignment(wrap_text=True, vertical='top')
    g.column_dimensions['A'].width = 26
    g.column_dimensions['B'].width = 28
    g.column_dimensions['C'].width = 95
    dv = DataValidation(type='list', formula1='"' + ','.join(DAYS) + '"', allow_blank=True)
    g.add_data_validation(dv); dv.add('B4')
    dv = DataValidation(type='list', formula1='"' + ','.join(RULES) + '"', allow_blank=True)
    g.add_data_validation(dv); dv.add('B10')

    # --- Rates
    rt = wb.create_sheet('Rates')
    for j, h in enumerate(['Person', 'Hourly rate'], start=1):
        c = rt.cell(row=1, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
    for i in range(2, 202):
        for j in (1, 2):
            rt.cell(row=i, column=j).fill = INPUT_FILL
    if example:
        for i, (p, v) in enumerate(EXAMPLE_RATES, start=2):
            rt.cell(row=i, column=1, value=p)
            rt.cell(row=i, column=2, value=v)
    rt.column_dimensions['A'].width = 28
    rt.column_dimensions['B'].width = 16
    rt.cell(row=1, column=4, value='Names must match the Assignee column exactly. Optional.')
    # --- Holidays
    ho = wb.create_sheet('Holidays')
    for j, h in enumerate(['Date', 'Name'], start=1):
        c = ho.cell(row=1, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
    for i in range(2, 202):
        ho.cell(row=i, column=1).fill = INPUT_FILL
        ho.cell(row=i, column=1).number_format = '@'
        ho.cell(row=i, column=2).fill = INPUT_FILL
    if example:
        for i, (d, n) in enumerate(EXAMPLE_HOLIDAYS, start=2):
            ho.cell(row=i, column=1, value=d)
            ho.cell(row=i, column=2, value=n)
    ho.column_dimensions['A'].width = 16
    ho.column_dimensions['B'].width = 32
    ho.cell(row=1, column=4, value='Days everyone is off (year-month-day). Used when days are counted as Weekdays. Optional.')

    # --- Leave
    lv = wb.create_sheet('Leave')
    for j, h in enumerate(['Person', 'From', 'To'], start=1):
        c = lv.cell(row=1, column=j, value=h)
        c.fill, c.font = HEAD_FILL, HEAD_FONT
    for i in range(2, 202):
        for j in (1, 2, 3):
            lv.cell(row=i, column=j).fill = INPUT_FILL
            if j > 1:
                lv.cell(row=i, column=j).number_format = '@'
    if example:
        for i, (p_, f_, t_) in enumerate(EXAMPLE_LEAVE, start=2):
            lv.cell(row=i, column=1, value=p_)
            lv.cell(row=i, column=2, value=f_)
            lv.cell(row=i, column=3, value=t_)
    lv.column_dimensions['A'].width = 24
    lv.column_dimensions['B'].width = 16
    lv.column_dimensions['C'].width = 16
    lv.cell(row=1, column=5, value='Days a person is away. Leave "To" blank for a single day. Names must match the Assignee column. Optional.')

    def log_sheet(name, head, widths, example_rows, date_cols, lists, whole, numeric, note):
        ws = wb.create_sheet(name)
        for j, h in enumerate(head, start=1):
            c = ws.cell(row=1, column=j, value=h)
            c.fill, c.font = HEAD_FILL, HEAD_FONT
            ws.column_dimensions[get_column_letter(j)].width = widths[j - 1]
        for i in range(2, 202):
            for j, h in enumerate(head, start=1):
                c = ws.cell(row=i, column=j)
                c.fill = INPUT_FILL
                if h in date_cols or h in ('ID',):
                    c.number_format = '@'
        if example:
            for i, row in enumerate(example_rows, start=2):
                for j, v in enumerate(row, start=1):
                    if v != '':
                        ws.cell(row=i, column=j, value=v)
        col = lambda h: get_column_letter(head.index(h) + 1)
        for h, values in lists.items():
            dv = DataValidation(type='list', formula1='"' + ','.join(values) + '"', allow_blank=True, showErrorMessage=True,
                                errorTitle=h, error='Pick one from the list.')
            ws.add_data_validation(dv); dv.add(f'{col(h)}2:{col(h)}201')
        for h in date_cols:
            c_ = col(h)
            dv = DataValidation(type='custom',
                                formula1=f'OR({c_}2="",AND(LEN({c_}2)=10,MID({c_}2,5,1)="-",MID({c_}2,8,1)="-",ISNUMBER(--LEFT({c_}2,4)),ISNUMBER(--MID({c_}2,6,2)),ISNUMBER(--RIGHT({c_}2,2))))',
                                allow_blank=True, showErrorMessage=True, errorTitle='Date', error='Write the date as year-month-day, for example 2026-03-31.')
            ws.add_data_validation(dv); dv.add(f'{c_}2:{c_}201')
        for h in whole:
            dv = DataValidation(type='whole', operator='between', formula1='1', formula2='5', allow_blank=True, showErrorMessage=True,
                                errorTitle=h, error='Enter a whole number from 1 to 5.')
            ws.add_data_validation(dv); dv.add(f'{col(h)}2:{col(h)}201')
        for h in numeric:
            dv = DataValidation(type='decimal', operator='between', formula1='-100000', formula2='100000', allow_blank=True, showErrorMessage=True,
                                errorTitle=h, error='Enter a plain number (use a minus sign for a reduction).')
            ws.add_data_validation(dv); dv.add(f'{col(h)}2:{col(h)}201')
        ws.cell(row=1, column=len(head) + 2, value=note)

    log_sheet('Risks', RISK_HEAD, [8, 44, 18, 14, 14, 14, 12, 34, 14, 14, 24], EXAMPLE_RISKS, ['Action due', 'Action done'],
              {'Response': ['Avoid', 'Mitigate', 'Transfer', 'Accept'], 'Status': ['Open', 'Closed', 'Occurred']},
              ['Probability (1-5)', 'Impact (1-5)'], [],
              'Optional. Probability and Impact are whole numbers 1 (lowest) to 5 (highest); score = probability x impact. Leave blank if not yet rated: the risk is listed as not scored. Project (optional) is the project name; the Portfolio tab uses it to show risks across projects.')
    log_sheet('Issues', ISSUE_HEAD, [8, 44, 12, 14, 12, 14, 14, 14], EXAMPLE_ISSUES, ['Raised', 'Due', 'Resolved'],
              {'Priority': ['Low', 'Medium', 'High', 'Critical'], 'Status': ['Open', 'Resolved', 'Closed']}, [], [],
              'Optional. An issue is a problem that has already happened. Age is counted from Raised to the status date (calendar days).')
    log_sheet('Changes', CHANGE_HEAD, [8, 44, 16, 12, 14, 14, 16, 22], EXAMPLE_CHANGES, ['Requested', 'Decided'],
              {'Decision': ['Requested', 'Approved', 'Rejected', 'Withdrawn']}, [], ['Cost impact (h)', 'Schedule impact (days)'],
              'Optional. Cost impact in hours and schedule impact in days; use a minus sign for a reduction. Only Approved changes are added up.')

    # --- Initiate sheets
    def plain_sheet(name, head, widths, rows, note, example_rows):
        ws = wb.create_sheet(name)
        for j, h in enumerate(head, start=1):
            c = ws.cell(row=1, column=j, value=h)
            c.fill, c.font = HEAD_FILL, HEAD_FONT
            ws.column_dimensions[get_column_letter(j)].width = widths[j - 1]
        for i in range(2, rows + 2):
            for j in range(1, len(head) + 1):
                c = ws.cell(row=i, column=j)
                c.fill = INPUT_FILL
                if head[j - 1] in ('Due', 'Received', 'Date', 'ID', 'Done on', 'Raised', 'Last updated', 'Next gate'):
                    c.number_format = '@'
        if example:
            for i, row in enumerate(example_rows, start=2):
                for j, v in enumerate(row, start=1):
                    if v != '':
                        ws.cell(row=i, column=j, value=v)
        ws.cell(row=1, column=len(head) + 2, value=note)
        return ws

    for sname, srows, first, snote in (
        ('Scoring', EXAMPLE_SCORING, 'Option', 'Optional. Type criteria across row 1 and the importance of each in row 2 (any positive numbers). Then one option per row below, scored on your own scale. A missing score leaves that option unscored.'),
        ('Priority', EXAMPLE_PRIORITY, 'Project', 'Optional. For the Portfolio tab. Type your prioritisation criteria across row 1 and the importance of each in row 2 (any positive numbers). Then one project per row below (names as on the Tasks sheet), scored on your own scale. A missing score leaves that project unscored.'),
    ):
        sc = wb.create_sheet(sname)
        for j in range(1, 10):
            c = sc.cell(row=1, column=j, value=first if j == 1 else None)
            c.fill, c.font = HEAD_FILL, HEAD_FONT
            sc.column_dimensions[get_column_letter(j)].width = 22 if j == 1 else 14
            for i in range(2, 32):
                sc.cell(row=i, column=j).fill = INPUT_FILL
        sc.cell(row=2, column=1, value='Weight').font = Font(bold=True)
        if example:
            for i, row in enumerate(srows, start=1):
                for j, v in enumerate(row, start=1):
                    if v != '':
                        sc.cell(row=i, column=j, value=v)
        sc['A1'].comment = Comment(snote, 'Spashta')
    plain_sheet('Business case', ['Period', 'Cost', 'Benefit'], [10, 14, 14], 20,
                'Optional. Period 0 is today (not discounted), 1 is the end of year 1, and so on. Money amounts in one currency. Set the Discount rate (%) on the Settings sheet.', EXAMPLE_CASE)
    st = plain_sheet('Stakeholders', STAKE_HEAD, [24, 24, 14, 16, 30], 40,
                     'Optional. Power and Interest are whole numbers 1 (lowest) to 5 (highest). Set "Stakeholder high from" on the Settings sheet.', EXAMPLE_STAKE)
    dv = DataValidation(type='whole', operator='between', formula1='1', formula2='5', allow_blank=True, showErrorMessage=True, errorTitle='Score', error='Enter a whole number from 1 to 5.')
    st.add_data_validation(dv); dv.add('C2:D41')
    so = plain_sheet('RFI-RFP', SOL_HEAD, [8, 8, 26, 14, 14, 16], 40,
                     'Optional. One row per request sent to a vendor. Type is RFI (request for information), RFP (request for proposal) or RFQ (request for quotation). A row with no Received date and a Due date before the status date counts as overdue.', EXAMPLE_SOL)
    dv = DataValidation(type='list', formula1='"RFI,RFP,RFQ"', allow_blank=True)
    so.add_data_validation(dv); dv.add('B2:B41')
    go = plain_sheet('Go-no-go', GO_HEAD, [14, 20, 14, 50], 1,
                     'Optional. Your decision record. A No go or Hold needs a reason. Leave blank until decided.', EXAMPLE_GO)
    dv = DataValidation(type='list', formula1='"Go,No go,Hold"', allow_blank=True)
    go.add_data_validation(dv); dv.add('A2')
    gc = plain_sheet('Gate checklist', ['Criterion', 'Owner', 'Met', 'Note'], [40, 16, 16, 40], 30,
                     'Optional. Write your own criteria for the go / no-go decision (the app supplies none). Met is Yes, No or Not applicable; blank means not answered yet.', EXAMPLE_GATE)
    dv = DataValidation(type='list', formula1='"Yes,No,Not applicable"', allow_blank=True)
    gc.add_data_validation(dv); dv.add('C2:C31')

    # --- Close sheets
    ck = plain_sheet('Checklist', CHECK_HEAD, [18, 46, 14, 16, 14], 60,
                     'Optional. Group the items however you like (for example Go-live, Acceptance, Contract closure, Handover). Status is Open, Done or Not applicable; a blank status counts as not done.', EXAMPLE_CHECK)
    dv = DataValidation(type='list', formula1='"Open,Done,Not applicable"', allow_blank=True)
    ck.add_data_validation(dv); dv.add('D2:D61')
    ls = plain_sheet('Lessons', LESSON_HEAD, [16, 46, 40, 14, 14], 60,
                     'Optional. Category is Went well, Went badly or Do differently (or your own). Write what happened and what to do next time.', EXAMPLE_LESSON)
    dv = DataValidation(type='list', formula1='"Went well,Went badly,Do differently"', allow_blank=True)
    ls.add_data_validation(dv); dv.add('A2:A61')
    plain_sheet('Benefits', BEN_HEAD, [8, 40, 16, 22, 12, 12, 14], 40,
                'Optional. Planned and Realised are plain numbers in the same unit (the Measure column says which). Leave Realised blank until it can be measured: blank is not 0.', EXAMPLE_BEN)
    plain_sheet('Projects', PROJ_HEAD, [28, 16, 20, 14, 14], 40,
                'Optional. One row per project (the Project name must match the Tasks sheet). Phase is one of your phases; Last updated and Next gate are year-month-day. Set "Phase order" and "Update due every (days)" on the Settings sheet. Blank means not known.', EXAMPLE_PROJ)
    wb._sheets.insert(wb._sheets.index(wb['Settings']) + 1, wb._sheets.pop(wb._sheets.index(wb['Projects'])))
    wb.active = 1
    wb.save(path)


def write_csv(path, example):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        if example:
            w.writerows(EXAMPLE)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build(os.path.join(OUT, 'spashta-template.xlsx'), False)
    build(os.path.join(OUT, 'spashta-example.xlsx'), True)
    write_csv(os.path.join(OUT, 'spashta-template.csv'), False)
    write_csv(os.path.join(OUT, 'spashta-example.csv'), True)
    print('written to', os.path.normpath(OUT))
