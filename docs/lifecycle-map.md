# Lifecycle coverage map: idea and RFI to closure and benefits

Status: planning draft (2026-10-16). Nothing here is built yet unless marked Have.
Rules that still apply to every item: privacy-first (all in the browser), nothing guessed (a blank is not 0), assumptions shown on screen, limits are "starting values, not a standard", every formula gets a Learn card with a worked example and is checked against an independent source before it ships, no use of professional-body trademarks.

Key: **Have** = built today. **Partial** = some of it. **New** = not built.

## 1. Idea, RFI and RFP (before there is a project)
Questions: Which option or vendor? What did we ask and who answered?
| Item | Status | How |
|---|---|---|
| RFI / RFP / RFQ tracker: sent, due, received, days to respond, who has not answered | New | Template sheet "Vendors" |
| Weighted scoring of vendor responses (criteria weights x scores = total) plus a "does the ranking change if weights move 10%?" check | New | Template sheet; weights always entered by the user |
| Rough cost and benefit comparison of options | New | Same sheet, plain numbers |
Note: nobody exports this from a tool, so the template is the right vehicle.

## 2. Business case and approval (initiation)
Questions: Is it worth doing? Who must agree? Go or no-go?
| Item | Status | How |
|---|---|---|
| Payback period, ROI, benefit-cost ratio, net present value (discount rate entered by the user, never assumed) | New | "Business case" sheet |
| Stakeholder list with power / interest grid | New | Template sheet, grid view |
| Go / no-go and charter checklist | New | Checklist view, user-defined items |
| Assumptions and constraints register | New | Part of the RAID sheet |

## 3. Planning
Questions: What exactly, by when, for how much, with whom, what could go wrong?
| Item | Status | How |
|---|---|---|
| Task list, estimates in hours, planned dates, assignee | Have | Template / any export |
| Three-point estimates (optimistic, likely, pessimistic) | New | Two extra template columns |
| Dependencies, critical path and float | New | Read links from Project XML; template column "Depends on" |
| Baseline snapshot (freeze plan, compare later) | New | On-device snapshots |
| Budget baseline, contingency and reserve | Partial | Cost in money exists; reserve fields New |
| Holidays and leave | New | Settings sheet list |
| Risk register: probability x impact = exposure, owner, response, heat map | New | "Risks" sheet |
| Procurement and contract tracker | New | "Contracts" sheet |
| Communication plan, quality plan | New | Simple register sheets (low priority) |

## 4. Delivery and control (the daily work)
Questions: Are we on track? Why not? What will happen next?
| Item | Status | How |
|---|---|---|
| Earned value, CPI, SPI, forecasts, earned schedule | Have | Import |
| Flow: throughput, cycle time, WIP, age | Have | Flow |
| Schedule: on-time, overdue | Have | Schedule |
| Resources: weekly load | Have | Resources |
| Quality: defects, age, found after release | Have | Quality |
| Health status and roll-up | Have | Overview, Portfolio |
| "Why is it red?" drill-down (tasks that hurt CPI / SPI most) | New | Overview |
| Actual-cost line on the earned-value chart; monthly cash flow | New | Charts |
| Trends over time, burndown / burnup, cumulative flow | New | Snapshots |
| Milestones: planned vs forecast, slip | New | Milestone rows in the template |
| Forecast finish dates (50/85/95%) from past throughput | New | Simulation in the browser |
| RAID log: risks, assumptions, issues, dependencies; open and overdue items, ageing | New | "Risks" and "Issues" sheets |
| Status report: plain-language commentary on one printable page | New | Report view |

## 5. Change control
Questions: How much has scope grown? What did approved changes cost?
| Item | Status | How |
|---|---|---|
| Change log: requested, approved, rejected, days waiting | New | "Changes" sheet |
| Approved impact on cost and schedule, running total against baseline, scope growth % | New | Change view; prompts a re-baseline |

## 6. Transition and go-live
Questions: Are we ready to hand over?
| Item | Status | How |
|---|---|---|
| Readiness checklist (user-defined items, done / not done) | New | Checklist view |
| Test and acceptance progress (pass rate, open defects by severity) | Partial | Quality covers defects |
| Defects found after release | Have | Quality |
| Training and cutover tracking | New | Checklist rows |

## 7. Closure
Questions: Did we deliver what was promised? What did we learn?
| Item | Status | How |
|---|---|---|
| Final cost vs budget, finish vs plan, scope delivered vs planned | Partial | Computed from snapshots and baseline |
| Acceptance and contract-closure checklist | New | Checklist view |
| Lessons-learned register: what went well, what did not, action, owner | New | "Lessons" sheet |
| Closure report (one page) | New | Report view |
| Archive: export everything as one file | New | Download |

## 8. After the project: benefits
| Item | Status | How |
|---|---|---|
| Benefits promised vs realised, by date | New | "Benefits" sheet |
| Actual return vs business-case return | New | Same inputs as section 2 |

## 9. Portfolio and PMO level
| Item | Status | How |
|---|---|---|
| Health roll-up by programme and team | Have | Portfolio |
| Projects by phase (stage-gate view) | New | Phase column in the template |
| Demand vs capacity across projects | New | Uses assignee load across files |
| Prioritisation scoring (criteria and weights set by the PMO) | New | Weighted scoring, reused from section 1 |
| Risk heat map across projects | New | Roll-up of the risk sheets |
| Reporting discipline: which projects have not updated since N days | New | Snapshot dates |
| Data-quality score with "fix these first" | New | Readiness check, extended |

## Proposed order
1. **Wave A, deepen delivery (what PMs open every day):** why-is-it-red, RAID sheets, change log, milestones, actual-cost line, snapshots and trends, holidays.
2. **Wave B, planning and initiation:** business case (payback, ROI, benefit-cost, NPV), three-point estimates, vendor scoring for RFI/RFP, baseline, critical path.
3. **Wave C, closure and benefits and PMO:** checklists, lessons learned, closure report, benefits tracking, stage-gate view, demand vs capacity.
4. **Throughout:** Learn cards and practice questions for every new measure; the redesign and interactive dashboard; tool adapters when real headers arrive.

## How it fits the app
- One template workbook grows new sheets (Risks, Changes, Vendors, Milestones, Benefits, Lessons). Each sheet is optional and has its own readiness line, so a small team can ignore sheets it does not use.
- Sidebar groups change from Start / Analyse / Learn to Start, Initiate and plan, Deliver and control, Close and learn, Portfolio, Learn.
- Every formula is confirmed against an independent source before it ships and shown with its working.
