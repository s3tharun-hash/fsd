// Business logic engine for schedules, weekly off days, leave calculations, and permission conflicts
import { DAYS_OF_WEEK } from './data.js';

/**
 * Converts "HH:MM" (24h) string into total minutes from 00:00
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes into "HH:MM" or readable format
 */
export function minutesToHoursStr(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Formats a Date object or YYYY-MM-DD string to user-friendly format (e.g., "Wed, Oct 14, 2026")
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Formats 24h time "09:00" to "9:00 AM"
 */
export function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minStr = m < 10 ? `0${m}` : m;
  return `${hour12}:${minStr} ${period}`;
}

/**
 * Get readable day names for an array of weekly off day IDs (0=Sun, 6=Sat)
 */
export function getWeeklyOffDayNames(weeklyOffDays = [0, 6]) {
  return (weeklyOffDays || [])
    .map(id => DAYS_OF_WEEK.find(d => d.id === id)?.name)
    .filter(Boolean);
}

/**
 * Checks overlap between permission window and employee shift
 */
export function checkShiftOverlap(shiftStartStr, shiftEndStr, permStartStr, permEndStr) {
  const shiftStart = timeToMinutes(shiftStartStr);
  const shiftEnd = timeToMinutes(shiftEndStr);
  const permStart = timeToMinutes(permStartStr);
  const permEnd = timeToMinutes(permEndStr);

  const durationMinutes = Math.max(0, permEnd - permStart);
  const durationHours = parseFloat((durationMinutes / 60).toFixed(2));

  // Determine overlap window
  const overlapStart = Math.max(shiftStart, permStart);
  const overlapEnd = Math.min(shiftEnd, permEnd);
  const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
  const overlapsShift = overlapMinutes > 0;

  let description = '';
  if (overlapsShift) {
    if (overlapMinutes === durationMinutes) {
      description = `Entirely within shift (${formatTime12(shiftStartStr)} - ${formatTime12(shiftEndStr)}), totaling ${minutesToHoursStr(overlapMinutes)} of shift time.`;
    } else {
      description = `Partially overlaps shift (${formatTime12(shiftStartStr)} - ${formatTime12(shiftEndStr)}) by ${minutesToHoursStr(overlapMinutes)}.`;
    }
  } else {
    description = `Does not overlap shift hours (${formatTime12(shiftStartStr)} - ${formatTime12(shiftEndStr)}). Request falls outside shift.`;
  }

  return {
    overlapsShift,
    overlapMinutes,
    durationMinutes,
    durationHours,
    description
  };
}

/**
 * Check if a date is an employee's configured weekly off day
 */
export function isWeeklyOffDay(dateStr, weeklyOffDays = [0, 6]) {
  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
  const isOff = weeklyOffDays.includes(dayOfWeek);
  const dayName = DAYS_OF_WEEK.find(d => d.id === dayOfWeek)?.name || '';
  return { isOff, dayOfWeek, dayName };
}

/**
 * Check if a permission request conflicts with an existing Approved Leave
 */
export function checkLeaveConflict(permDateStr, employeeId, allLeaves) {
  const targetTime = new Date(permDateStr + 'T00:00:00').getTime();

  const conflictingLeave = allLeaves.find(leave => {
    if (leave.employeeId !== employeeId) return false;
    if (leave.status !== 'Approved') return false;

    const start = new Date(leave.startDate + 'T00:00:00').getTime();
    const end = new Date(leave.endDate + 'T00:00:00').getTime();
    return targetTime >= start && targetTime <= end;
  });

  return {
    hasConflict: !!conflictingLeave,
    conflictingLeave
  };
}

/**
 * Check if an employee already has duplicate or overlapping permission requests on the same date
 */
export function checkDuplicatePermission(permDateStr, permStartStr, permEndStr, employeeId, allPermissions, ignoreId = null) {
  const newStart = timeToMinutes(permStartStr);
  const newEnd = timeToMinutes(permEndStr);

  const conflicts = allPermissions.filter(p => {
    if (p.id === ignoreId) return false;
    if (p.employeeId !== employeeId) return false;
    if (p.date !== permDateStr) return false;
    if (p.status === 'Rejected') return false; // Rejected permissions don't conflict

    const existStart = timeToMinutes(p.startTime);
    const existEnd = timeToMinutes(p.endTime);

    // Overlap condition: max(start1, start2) < min(end1, end2)
    return Math.max(newStart, existStart) < Math.min(newEnd, existEnd);
  });

  return {
    hasConflict: conflicts.length > 0,
    conflictingRequests: conflicts
  };
}

/**
 * Calculate leave days excluding employee's configured weekly off days
 */
export function calculateLeaveDays(startDateStr, endDateStr, weeklyOffDays = [0, 6]) {
  if (!startDateStr || !endDateStr) {
    return { totalCalendarDays: 0, leaveDays: 0, excludedDates: [] };
  }

  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (end < start) {
    return { error: 'End date cannot be prior to start date', totalCalendarDays: 0, leaveDays: 0, excludedDates: [] };
  }

  const excludedDates = [];
  let leaveDays = 0;
  let totalCalendarDays = 0;

  const current = new Date(start);
  while (current <= end) {
    totalCalendarDays++;
    const dayOfWeek = current.getDay();
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayMeta = DAYS_OF_WEEK.find(d => d.id === dayOfWeek);

    if (weeklyOffDays.includes(dayOfWeek)) {
      excludedDates.push({
        dateStr,
        dayName: dayMeta ? dayMeta.name : '',
        shortDate: formatDate(dateStr),
        reason: `Weekly off (${dayMeta ? dayMeta.name : 'Off day'})`
      });
    } else {
      leaveDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalCalendarDays,
    leaveDays,
    excludedDates
  };
}

/**
 * Calculate monthly leave balance and permission usage for an employee in a given month (YYYY-MM)
 */
export function getEmployeeMonthSummary(employee, allLeaves, allPermissions, policy, monthYearStr = '2026-10') {
  const allowance = employee.monthlyAllowance || policy.defaultMonthlyLeaveAllowance || 2.5;

  // Leaves approved for this employee in this month
  const approvedLeaves = allLeaves.filter(l => {
    if (l.employeeId !== employee.id || l.status !== 'Approved') return false;
    // Check if starts or ends in this month
    return l.startDate.startsWith(monthYearStr) || l.endDate.startsWith(monthYearStr);
  });

  // Calculate leave days taken in this month
  let leaveDaysTaken = 0;
  approvedLeaves.forEach(l => {
    // Re-verify leave days in this specific month
    const calc = calculateLeaveDays(l.startDate, l.endDate, employee.weeklyOffDays);
    leaveDaysTaken += calc.leaveDays;
  });

  // Approved permission hours in this month
  const approvedPermissions = allPermissions.filter(p => {
    return p.employeeId === employee.id && p.status === 'Approved' && p.date.startsWith(monthYearStr);
  });

  const permissionHoursUsed = approvedPermissions.reduce((sum, p) => sum + (p.hours || 0), 0);

  // Policy: deduct permission time from monthly leave?
  let permissionLeaveDeduction = 0;
  if (policy.deductPermissionFromMonthlyLeave) {
    const conversion = policy.permissionHoursPerLeaveDay || 8;
    permissionLeaveDeduction = parseFloat((permissionHoursUsed / conversion).toFixed(2));
  }

  const netLeaveTaken = leaveDaysTaken + permissionLeaveDeduction;
  const remainingLeaveBalance = parseFloat(Math.max(0, allowance - netLeaveTaken).toFixed(2));

  // Pending leaves count
  const pendingLeaves = allLeaves.filter(l => l.employeeId === employee.id && l.status === 'Pending').length;
  // Pending permissions count
  const pendingPermissions = allPermissions.filter(p => p.employeeId === employee.id && p.status === 'Pending').length;

  return {
    allowance,
    leaveDaysTaken,
    permissionHoursUsed,
    permissionLeaveDeduction,
    remainingLeaveBalance,
    pendingLeaves,
    pendingPermissions,
    policyDeductEnabled: policy.deductPermissionFromMonthlyLeave,
    conversionRatio: policy.permissionHoursPerLeaveDay || 8
  };
}

/**
 * Evaluate the exact impact of a new or pending leave request on the employee's monthly balance
 */
export function previewLeaveBalanceImpact(employee, leaveDaysToAdd, allLeaves, allPermissions, policy, monthYearStr = '2026-10') {
  const current = getEmployeeMonthSummary(employee, allLeaves, allPermissions, policy, monthYearStr);
  const newLeaveDaysTaken = current.leaveDaysTaken + leaveDaysToAdd;
  const newNetTaken = newLeaveDaysTaken + current.permissionLeaveDeduction;
  const newRemainingBalance = parseFloat((current.allowance - newNetTaken).toFixed(2));
  const willExceed = newRemainingBalance < 0;

  return {
    currentAllowance: current.allowance,
    currentTaken: current.leaveDaysTaken,
    currentRemaining: current.remainingLeaveBalance,
    requestedDays: leaveDaysToAdd,
    projectedTaken: newLeaveDaysTaken,
    projectedRemaining: newRemainingBalance,
    willExceed,
    exceededBy: willExceed ? Math.abs(newRemainingBalance) : 0
  };
}
