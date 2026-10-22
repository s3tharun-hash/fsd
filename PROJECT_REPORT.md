# PROJECT REPORT
# WorkPulse Hub: Enterprise Employee Schedule, Permission Requests, and Monthly Leave Engine

---

## 1. Project Overview & Metadata

| Field | Details |
| :--- | :--- |
| **Project Title** | WorkPulse Hub |
| **Domain** | Full Stack Web Development / Human Resource Management Systems (HRMS) |
| **Live Production URL** | https://fsd-beta-snowy.vercel.app |
| **GitHub Repository** | https://github.com/s3tharun-hash/fsd |
| **Repository Visibility** | **Public** (Verified) |
| **Hosting Platform** | Vercel Cloud Platform (Global Edge Network) |
| **Version Control** | Git & GitHub |
| **Verification Suite** | 31 / 31 Automated Tests Passed (100% Pass Rate) |

---

## 2. Executive Summary / Abstract

Modern organizations face significant challenges in managing employee shifts, weekly off schedules, short-duration out-of-office permissions, and cumulative monthly leaves. Traditional systems often fail to calculate net leaves accurately across custom rosters (e.g., non-Saturday/Sunday off days) or treat short hourly permissions as full-day leave deductions.

**WorkPulse Hub** is a full-featured, responsive enterprise web application built to solve these coordination challenges. It provides a robust, rule-based scheduling and leave engine featuring:
- Role-based views for both **HR Admins** and **Employees**.
- **Dynamic shift rosters** supporting individual, non-standard weekly off days.
- An intelligent **short permission engine** with automated shift overlap calculation and conflict detection.
- A **monthly leave engine** that strictly excludes weekly off days from leave deductions.
- An interactive **31-day calendar view** with multi-month navigation and CSV report exporting.

Both the source repository and the deployed web application are publicly accessible and verified.

---

## 3. Technology Stack & Architecture

### 3.1 Architecture Overview
```
+-----------------------------------------------------------------+
|                       Client Browser                            |
|  +-----------------------------------------------------------+  |
|  |           Modern Glassmorphism UI (HTML5 + CSS3)          |  |
|  +-----------------------------------------------------------+  |
|  |             Role Switcher: HR Admin <---> Employee        |  |
|  +-----------------------------------------------------------+  |
|                                |                                |
|  +-----------------------------v-----------------------------+  |
|  |       Application Controller & View Renderer (app.js)     |  |
|  +-----------------------------------------------------------+  |
|                                |                                |
|  +-----------------------------v-----------------------------+  |
|  |         Core Business Engine (scheduleEngine.js)          |  |
|  |  * Shift Overlap Detection       * Off-Day Exclusions     |  |
|  |  * Conflict & Duplicate Checker  * Balance Projection     |  |
|  +-----------------------------v-----------------------------+  |
|                                |                                |
|  +-----------------------------v-----------------------------+  |
|  |         Mock State & Persistent Storage (data.js)         |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
                                 |
              [Deployed on Vercel Global Edge Network]
```

### 3.2 Technology Breakdown

1. **Frontend Presentation**:
   - **HTML5**: Semantic tags (`<header>`, `<main>`, `<section>`, `<nav>`, `<table>`, `<dialog>`).
   - **Vanilla CSS3**: Custom design system using CSS custom properties (variables), backdrop glassmorphism (`backdrop-filter: blur`), dark-mode palette, flexbox, and responsive CSS Grid.
2. **Application Logic**:
   - **Modern ES6+ JavaScript**: Native modular imports/exports (`import`/`export`), arrow functions, destructured assignments, and array functional methods (`filter`, `reduce`, `map`, `some`).
3. **Core Engine (`js/scheduleEngine.js`)**:
   - Pure algorithmic layer completely decoupled from DOM manipulation for deterministic unit and integration testing.
4. **Backend Server (`server.js`)**:
   - Lightweight Node.js HTTP server configured with correct MIME type resolution for local development and offline environments.
5. **Deployment & CI/CD**:
   - **Vercel**: Edge deployment configuration (`vercel.json`) with clean URL routing and automatic HTTPS certificate provisioning.
   - **Git & GitHub**: Version tracking with semantic commits and branch protection.

---

## 4. Key Modules & Functional Specifications

### Module 1: Employee Directory & Custom Roster Engine
- **Profile Management**: Displays employee code, full name, department/sector, assigned team lead, shift timing (start and end times), and weekly off configuration.
- **Custom Rosters**: Does not restrict off days to weekends; seamlessly supports variable off days (e.g., Monday & Tuesday off for customer support teams, Friday & Saturday for regional shifts).
- **Role-Based Access Control**:
  - **HR Admin View**: Create and edit employee profiles, configure global rules, review and resolve conflicting requests.
  - **Employee View**: View personal 7-day work roster (Monday through Sunday), remaining leave balance, and submit requests.
  - **Quick User Switcher**: Interactive dropdown to switch between Administrator and various employee personas instantly.

### Module 2: Short Permission Requests Engine
- **Purpose**: Tracks temporary out-of-office requests (e.g., 2-hour medical appointment or personal errand) distinct from full-day leaves.
- **Smart Shift Overlap Calculation**:
  $$\text{Overlap Duration} = \max\Big(0, \min(\text{Perm}_{\text{end}}, \text{Shift}_{\text{end}}) - \max(\text{Perm}_{\text{start}}, \text{Shift}_{\text{start}})\Big)$$
  Automatically informs supervisors whether the requested permission falls within active work hours or outside work hours.
- **Conflict & Duplicate Prevention**: Rejects duplicate permission requests for the same date and time range for the same employee.
- **Off-Day & Leave Conflict Flagging**:
  - Detects if an employee requests permission on a scheduled weekly off day.
  - Detects if an employee requests permission on an approved leave day.
  - Provides reviewers with explicit conflict resolution options (*Approved with Special Permission*, *Comp-Off Granted*, *Leave Adjusted*).

### Module 3: Monthly Leave Tracking & Balance Calculator
- **Independent Balance Tracking**: Monthly leave allowances, leaves taken, and remaining balances are tracked independently from hourly permissions.
- **Weekly Off Day Auto-Exclusion**:
  - When calculating leave duration across a date range (e.g., Friday to Monday), configured weekly off days (e.g., Saturday and Sunday) are strictly omitted from the leave count.
  - Transparently lists all excluded dates in the interface before submission.
- **Live Real-Time Impact Calculator**: Computes and displays total calendar days, excluded off days, net days deducted, and projected remaining balance before an employee submits their application.
- **Interactive 31-Day Calendar**:
  - Renders a color-coded monthly calendar displaying working shifts, weekly offs, approved leaves, and pending permission badges.
  - Multi-month navigation allows reviewing historical, current, and future months.

### Module 4: HR Policy Configuration
- Customizable default weekly off days (Saturday/Sunday default).
- Configurable monthly leave allowance (e.g., 2.5 days per month).
- **Flexible Leave-Deduction Policy**: Admin toggle allowing organizations to decide whether permissions deduct from leave balances (e.g., 8 hours = 1 day leave) or remain completely independent.

### Module 5: Data Export & Reporting
- One-click export to **CSV** format for employee attendance rosters, approved leave logs, and remaining balance summaries.

---

## 5. Automated Verification & Test Results

The application includes an automated test harness (`test_engine.js`) verifying all 31 core business rules across 7 test suites:

```
=== Running Verification Suite ===

Test 1: Shift Overlap Detection
  [PASS] 10:00-12:00 overlaps 09:00-18:00
  [PASS] Overlap duration is exactly 120 minutes (2h)
  [PASS] 19:00-21:00 falls outside 09:00-18:00 shift
  [PASS] Zero overlap minutes outside shift

Test 2: Weekly Off Calculation & Days Off Exclusion
  [PASS] Oct 17 (Sat) is weekly off for default employee
  [PASS] Oct 17 (Sat) is regular work day for custom employee (Mon/Tue off)
  [PASS] Oct 19 (Mon) is weekly off for custom employee

Test 3: Leave Duration Excluding Weekly Off Days
  [PASS] Total calendar days is 5
  [PASS] Net leave days is 3 (Sat & Sun excluded)
  [PASS] Exactly 2 dates excluded
  [PASS] Excluded Saturday Oct 17
  [PASS] Excluded Sunday Oct 18
  [PASS] Net leave days is 3 for custom employee
  [PASS] Exactly 2 dates excluded for custom employee
  [PASS] Excluded Monday Oct 19 for custom employee
  [PASS] Excluded Tuesday Oct 20 for custom employee

Test 4: Duplicate & Conflicting Permission Detection
  [PASS] Detects overlapping permission on 2026-10-14 for EMP-101 (existing 10:00-12:00)
  [PASS] Non-overlapping permission on same date is allowed (14:00-16:00 vs 10:00-12:00)

Test 5: Permission on Approved Leave Conflict Flag
  [PASS] Detects permission requested on approved leave date 2026-10-08
  [PASS] No leave conflict on 2026-10-14

Test 6: Policy Check - Separate vs Deducted Balances
  [PASS] Monthly allowance is 2.5
  [PASS] Leave taken is 2 days (Oct 8-9)
  [PASS] Remaining leave balance is 0.5
  [PASS] Permission hours used is 2h
  [PASS] Zero leave deduction when policy is separate
  [PASS] 2h permission = 0.25d leave deduction
  [PASS] Remaining balance becomes 0.25d (2.5 - 2.0 - 0.25)

Test 7: Live Balance Impact Preview
  [PASS] Current remaining is 0.5d
  [PASS] Requested days is 1.5d
  [PASS] Projected remaining is -1.0d (will exceed)
  [PASS] Correctly flags that balance will be exceeded

================================
Summary: 31 / 31 tests passed (100% SUCCESS)
```

---

## 6. Verification & Deployment Links

### 6.1 GitHub Repository
- **URL**: https://github.com/s3tharun-hash/fsd
- **Visibility**: Public
- **Primary Branch**: `main`
- **Clean Structure**: Excludes unnecessary build artifacts via configured `.gitignore`.

### 6.2 Live Vercel Production Deployment
- **URL**: https://fsd-beta-snowy.vercel.app
- **Status**: Active & Responding (`200 OK`)
- **Protocol**: HTTPS (SSL/TLS Secured)
- **Global CDN**: Enabled across Vercel edge nodes.

---

## 7. Submission Summary for Form / Evaluator

Copy and paste the corresponding details directly into your form:

- **GitHub Repository URL**:
  `https://github.com/s3tharun-hash/fsd`

- **Live Deployed Application URL**:
  `https://fsd-beta-snowy.vercel.app`

- **Project Name**:
  `WorkPulse Hub - Enterprise Employee Schedule & Leave Management Engine`
