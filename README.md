# WorkPulse Hub

Enterprise Employee Schedule, Permission Requests, and Monthly Leave Engine.

## Features

### 1. Employee Directory & Profiles
- **Employee Details**: Employee name, sector/department, team lead, shift start and end times, and weekly off days (with Saturday and Sunday as the default).
- **Custom Rosters**: Supports non-standard weekly off days (e.g., Monday & Tuesday off, Friday & Saturday off).
- **Role-Based Access**:
  - **HR Admins**: Full management to add/edit employees, modify shifts and off days, configure global policies, and review requests.
  - **Employees**: View their own profile, personal 7-day weekly schedule roster (Mon–Sun), monthly balances, and submit requests.
- **Active User Switcher**: Interactive switcher in the header to effortlessly toggle between HR Admin and Employee views.

### 2. Short Permission Requests Engine
- Separate permission request feature for short time away from work.
- Includes date, start & end time, reason, status (`Pending`, `Approved`, `Rejected`), and reviewer notes.
- **Shift Overlap Detection**: Checks whether the window overlaps with the employee's scheduled shift and flags the overlap duration for supervisor review.
- **Duplicate & Conflicting Request Prevention**: Prevents overlapping or duplicate permission requests for the same employee on the same date.
- **Approved Leave Day Conflict**: Flags requests falling on approved leave days for reviewer resolution.
- **Weekly Off Day Conflict**: Flags requests falling on scheduled weekly off days for reviewer resolution.
- **Conflict Resolution Flow**: Allows reviewers to select explicit conflict resolution categories (e.g., *Approved with Special Permission*, *Comp-Off Granted*, *Leave Adjusted*).

### 3. Monthly Leave Tracking & Balance Calculator
- Shows monthly leave allowance, leave taken, and remaining balance separately from permissions.
- **Weekly Off Day Exclusion**: Saturday and Sunday are not counted towards leave by default; calculations use each employee's configured weekly off days and visibly list all excluded dates.
- **Live Real-time Calculator**: Displays total calendar days, excluded off days, net days, current balance, and projected balance before submission or approval.
- **Interactive Monthly Calendar**: Visual 31-day calendar view displaying working shifts, weekly offs, approved leaves, and permission chips.
- **Multi-Month Navigation**: Browse past, current, and future months with dynamic balance recalculation.
- **CSV Report Export**: Download comprehensive timesheet and balance reports with one click.

### 4. HR Admin Policy Configuration
- Default Weekly Off Days selector (Sunday & Saturday default).
- Default Monthly Leave Allowance.
- **Permission Deduction Toggle**: Turn on/off whether permission hours reduce monthly leave (with configurable conversion ratio: e.g., 8 hours = 1 day leave). By default, permissions and leave balances are kept completely independent.

## Getting Started

Run the application locally:

```bash
# Start the local server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Automated Verification Suite

Run the automated verification suite to test all 31 business rules:

```bash
node test_engine.js
```
