// Comprehensive Automated Verification Suite for WorkPulse Engine
import {
  timeToMinutes,
  minutesToHoursStr,
  formatDate,
  formatTime12,
  getWeeklyOffDayNames,
  checkShiftOverlap,
  isWeeklyOffDay,
  checkLeaveConflict,
  checkDuplicatePermission,
  calculateLeaveDays,
  getEmployeeMonthSummary,
  previewLeaveBalanceImpact
} from './js/scheduleEngine.js';

import {
  INITIAL_EMPLOYEES,
  INITIAL_LEAVES,
  INITIAL_PERMISSIONS,
  INITIAL_POLICIES
} from './js/data.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('=== Running Verification Suite ===\n');

// 1. Employee and Shift Overlap Check
console.log('Test 1: Shift Overlap Detection');
const shiftCheck1 = checkShiftOverlap('09:00', '18:00', '10:00', '12:00');
assert(shiftCheck1.overlapsShift === true, '10:00-12:00 overlaps 09:00-18:00');
assert(shiftCheck1.overlapMinutes === 120, 'Overlap duration is exactly 120 minutes (2h)');

const shiftCheck2 = checkShiftOverlap('09:00', '18:00', '19:00', '21:00');
assert(shiftCheck2.overlapsShift === false, '19:00-21:00 falls outside 09:00-18:00 shift');
assert(shiftCheck2.overlapMinutes === 0, 'Zero overlap minutes outside shift');

// 2. Weekly Off Days Check (Default Saturday & Sunday vs Custom)
console.log('\nTest 2: Weekly Off Calculation & Days Off Exclusion');
const defaultEmp = INITIAL_EMPLOYEES.find(e => e.id === 'EMP-101'); // Off: [0, 6] (Sun, Sat)
const customEmp = INITIAL_EMPLOYEES.find(e => e.id === 'EMP-104');  // Off: [1, 2] (Mon, Tue)

// Saturday Oct 17, 2026: 2026-10-17 is Saturday (day 6)
assert(isWeeklyOffDay('2026-10-17', defaultEmp.weeklyOffDays).isOff === true, 'Oct 17 (Sat) is weekly off for default employee');
assert(isWeeklyOffDay('2026-10-17', customEmp.weeklyOffDays).isOff === false, 'Oct 17 (Sat) is regular work day for custom employee (Mon/Tue off)');
assert(isWeeklyOffDay('2026-10-19', customEmp.weeklyOffDays).isOff === true, 'Oct 19 (Mon) is weekly off for custom employee');

// 3. Leave calculation excluding weekly off days
console.log('\nTest 3: Leave Duration Excluding Weekly Off Days');
// Oct 16 (Fri) to Oct 20 (Tue) 2026
// Days: Fri (16), Sat (17 - Off), Sun (18 - Off), Mon (19), Tue (20) -> 5 total calendar days, 2 excluded, 3 net leave days!
const leaveCalc1 = calculateLeaveDays('2026-10-16', '2026-10-20', defaultEmp.weeklyOffDays);
assert(leaveCalc1.totalCalendarDays === 5, 'Total calendar days is 5');
assert(leaveCalc1.leaveDays === 3, 'Net leave days is 3 (Sat & Sun excluded)');
assert(leaveCalc1.excludedDates.length === 2, 'Exactly 2 dates excluded');
assert(leaveCalc1.excludedDates[0].dateStr === '2026-10-17', 'Excluded Saturday Oct 17');
assert(leaveCalc1.excludedDates[1].dateStr === '2026-10-18', 'Excluded Sunday Oct 18');

// For custom employee (Mon & Tue off), same dates Fri 16 - Tue 20:
// Fri (16 - work), Sat (17 - work), Sun (18 - work), Mon (19 - OFF), Tue (20 - OFF) -> 3 net leave days, excluded Mon Oct 19 and Tue Oct 20
const leaveCalc2 = calculateLeaveDays('2026-10-16', '2026-10-20', customEmp.weeklyOffDays);
assert(leaveCalc2.leaveDays === 3, 'Net leave days is 3 for custom employee');
assert(leaveCalc2.excludedDates.length === 2, 'Exactly 2 dates excluded for custom employee');
assert(leaveCalc2.excludedDates[0].dateStr === '2026-10-19', 'Excluded Monday Oct 19 for custom employee');
assert(leaveCalc2.excludedDates[1].dateStr === '2026-10-20', 'Excluded Tuesday Oct 20 for custom employee');

// 4. Duplicate / Conflicting Permission Detection on Same Date
console.log('\nTest 4: Duplicate & Conflicting Permission Detection');
const dupCheck1 = checkDuplicatePermission('2026-10-14', '11:00', '13:00', 'EMP-101', INITIAL_PERMISSIONS);
assert(dupCheck1.hasConflict === true, 'Detects overlapping permission on 2026-10-14 for EMP-101 (existing 10:00-12:00)');

const dupCheck2 = checkDuplicatePermission('2026-10-14', '14:00', '16:00', 'EMP-101', INITIAL_PERMISSIONS);
assert(dupCheck2.hasConflict === false, 'Non-overlapping permission on same date is allowed (14:00-16:00 vs 10:00-12:00)');

// 5. Approved Leave Conflict Detection for Permission
console.log('\nTest 5: Permission on Approved Leave Conflict Flag');
// Sarah Chen has approved leave on 2026-10-08 and 2026-10-09
const leaveConflict1 = checkLeaveConflict('2026-10-08', 'EMP-101', INITIAL_LEAVES);
assert(leaveConflict1.hasConflict === true, 'Detects permission requested on approved leave date 2026-10-08');

const leaveConflict2 = checkLeaveConflict('2026-10-14', 'EMP-101', INITIAL_LEAVES);
assert(leaveConflict2.hasConflict === false, 'No leave conflict on 2026-10-14');

// 6. Policy Check: Separate Balances vs Deducting Permission from Leave
console.log('\nTest 6: Policy Check - Separate vs Deducted Balances');
// Default Policy: deductPermissionFromMonthlyLeave = false
const summarySeparate = getEmployeeMonthSummary(defaultEmp, INITIAL_LEAVES, INITIAL_PERMISSIONS, INITIAL_POLICIES, '2026-10');
assert(summarySeparate.allowance === 2.5, 'Monthly allowance is 2.5');
assert(summarySeparate.leaveDaysTaken === 2, 'Leave taken is 2 days (Oct 8-9)');
assert(summarySeparate.remainingLeaveBalance === 0.5, 'Remaining leave balance is 0.5');
assert(summarySeparate.permissionHoursUsed === 2, 'Permission hours used is 2h');
assert(summarySeparate.permissionLeaveDeduction === 0, 'Zero leave deduction when policy is separate');

// Policy Enabled: deductPermissionFromMonthlyLeave = true (8h = 1d)
const policyDeduct = { ...INITIAL_POLICIES, deductPermissionFromMonthlyLeave: true, permissionHoursPerLeaveDay: 8 };
const summaryDeduct = getEmployeeMonthSummary(defaultEmp, INITIAL_LEAVES, INITIAL_PERMISSIONS, policyDeduct, '2026-10');
assert(summaryDeduct.permissionLeaveDeduction === 0.25, '2h permission = 0.25d leave deduction');
assert(summaryDeduct.remainingLeaveBalance === 0.25, 'Remaining balance becomes 0.25d (2.5 - 2.0 - 0.25)');

// 7. Live Balance Preview Calculation
console.log('\nTest 7: Live Balance Impact Preview');
const preview = previewLeaveBalanceImpact(defaultEmp, 1.5, INITIAL_LEAVES, INITIAL_PERMISSIONS, INITIAL_POLICIES, '2026-10');
assert(preview.currentRemaining === 0.5, 'Current remaining is 0.5d');
assert(preview.requestedDays === 1.5, 'Requested days is 1.5d');
assert(preview.projectedRemaining === -1.0, 'Projected remaining is -1.0d (will exceed)');
assert(preview.willExceed === true, 'Correctly flags that balance will be exceeded');

console.log(`\n================================`);
console.log(`Results: ${passed} / ${total} tests passed.`);
if (passed === total) {
  console.log('ALL TESTS PASSED PERFECTLY! 🚀');
} else {
  process.exit(1);
}
