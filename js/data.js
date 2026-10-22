// Data models and LocalStorage persistence

const STORAGE_KEYS = {
  EMPLOYEES: 'hr_employees_v1',
  POLICIES: 'hr_policies_v1',
  PERMISSIONS: 'hr_permissions_v1',
  LEAVES: 'hr_leaves_v1',
  CURRENT_USER: 'hr_current_user_v1'
};

// Days of week mapping (0: Sunday, 1: Monday, ... 6: Saturday)
export const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' }
];

export const DEPARTMENTS = [
  'Engineering',
  'Product & Design',
  'Customer Operations',
  'Human Resources',
  'Marketing & Growth',
  'Finance & Legal'
];

export const INITIAL_POLICIES = {
  defaultWeeklyOff: [0, 6], // Sunday & Saturday
  defaultMonthlyLeaveAllowance: 2.5,
  deductPermissionFromMonthlyLeave: false, // Default is false as requested
  permissionHoursPerLeaveDay: 8, // Conversion if policy enabled
  maxPermissionHoursPerRequest: 4
};

export const INITIAL_EMPLOYEES = [
  {
    id: 'EMP-101',
    name: 'Sarah Chen',
    email: 'sarah.chen@acme.corp',
    sector: 'Engineering',
    teamLead: 'Marcus Vance',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    weeklyOffDays: [0, 6], // Saturday and Sunday
    monthlyAllowance: 2.5,
    role: 'HR Admin', // Can toggle view
    avatarBg: 'linear-gradient(135deg, #6366f1, #8b5cf6)'
  },
  {
    id: 'EMP-102',
    name: 'Marcus Vance',
    email: 'marcus.v@acme.corp',
    sector: 'Engineering',
    teamLead: 'Elena Rostova (VP)',
    shiftStart: '08:30',
    shiftEnd: '17:30',
    weeklyOffDays: [0, 6],
    monthlyAllowance: 2.5,
    role: 'Employee',
    avatarBg: 'linear-gradient(135deg, #06b6d4, #3b82f6)'
  },
  {
    id: 'EMP-103',
    name: 'Priya Patel',
    email: 'priya.patel@acme.corp',
    sector: 'Product & Design',
    teamLead: 'Sarah Chen',
    shiftStart: '10:00',
    shiftEnd: '19:00',
    weeklyOffDays: [0, 6],
    monthlyAllowance: 2.5,
    role: 'Employee',
    avatarBg: 'linear-gradient(135deg, #ec4899, #f43f5e)'
  },
  {
    id: 'EMP-104',
    name: 'David Kim',
    email: 'david.kim@acme.corp',
    sector: 'Customer Operations',
    teamLead: 'Priya Patel',
    shiftStart: '13:00',
    shiftEnd: '22:00',
    weeklyOffDays: [1, 2], // Mon & Tue off for 24/7 ops
    monthlyAllowance: 2.5,
    role: 'Employee',
    avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)'
  },
  {
    id: 'EMP-105',
    name: 'Aisha Al-Mansoor',
    email: 'aisha.m@acme.corp',
    sector: 'Human Resources',
    teamLead: 'Elena Rostova (VP)',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    weeklyOffDays: [5, 6], // Fri & Sat off
    monthlyAllowance: 3.0,
    role: 'HR Admin',
    avatarBg: 'linear-gradient(135deg, #10b981, #059669)'
  },
  {
    id: 'EMP-106',
    name: 'Liam O\'Connor',
    email: 'liam.oc@acme.corp',
    sector: 'Engineering',
    teamLead: 'Marcus Vance',
    shiftStart: '07:00',
    shiftEnd: '16:00',
    weeklyOffDays: [0, 6],
    monthlyAllowance: 2.5,
    role: 'Employee',
    avatarBg: 'linear-gradient(135deg, #8b5cf6, #d946ef)'
  }
];

// Sample prefilled requests for current month (Oct 2026 based on metadata)
export const INITIAL_LEAVES = [
  {
    id: 'LEV-501',
    employeeId: 'EMP-101',
    employeeName: 'Sarah Chen',
    startDate: '2026-10-08',
    endDate: '2026-10-09',
    type: 'Casual Leave',
    reason: 'Family event and travel',
    requestedDays: 2,
    excludedDates: [], // Thu & Fri, no weekly off excluded
    status: 'Approved',
    reviewer: 'Aisha Al-Mansoor',
    reviewNote: 'Approved. Enjoy your family time.',
    appliedOn: '2026-10-02'
  },
  {
    id: 'LEV-502',
    employeeId: 'EMP-103',
    employeeName: 'Priya Patel',
    startDate: '2026-10-16', // Fri
    endDate: '2026-10-20',   // Tue (Crosses Sat Oct 17, Sun Oct 18)
    type: 'Annual Leave',
    reason: 'Vacation trip',
    requestedDays: 3, // Fri, Mon, Tue (Excludes Sat & Sun)
    excludedDates: ['2026-10-17', '2026-10-18'],
    status: 'Approved',
    reviewer: 'Aisha Al-Mansoor',
    reviewNote: 'Approved. 2 weekend days excluded from count.',
    appliedOn: '2026-10-05'
  },
  {
    id: 'LEV-503',
    employeeId: 'EMP-104',
    employeeName: 'David Kim',
    startDate: '2026-10-19', // Mon (David Kim has Mon & Tue off!)
    endDate: '2026-10-22',   // Thu
    type: 'Medical Leave',
    reason: 'Dental surgery recovery',
    requestedDays: 2, // Excludes Mon Oct 19 and Tue Oct 20!
    excludedDates: ['2026-10-19', '2026-10-20'],
    status: 'Pending',
    reviewer: null,
    reviewNote: '',
    appliedOn: '2026-10-12'
  }
];

export const INITIAL_PERMISSIONS = [
  {
    id: 'PRM-201',
    employeeId: 'EMP-101',
    employeeName: 'Sarah Chen',
    date: '2026-10-14',
    startTime: '10:00',
    endTime: '12:00',
    hours: 2,
    reason: 'Doctor checkup & routine blood work',
    status: 'Approved',
    reviewer: 'Aisha Al-Mansoor',
    reviewNote: 'Approved. Please coordinate handover with Marcus.',
    flags: {
      overlapsShift: true,
      overlapMinutes: 120,
      onWeeklyOff: false,
      onApprovedLeave: false
    },
    appliedOn: '2026-10-13'
  },
  {
    id: 'PRM-202',
    employeeId: 'EMP-102',
    employeeName: 'Marcus Vance',
    date: '2026-10-15',
    startTime: '15:30',
    endTime: '17:30',
    hours: 2,
    reason: 'Parent-teacher school conference',
    status: 'Pending',
    reviewer: null,
    reviewNote: '',
    flags: {
      overlapsShift: true,
      overlapMinutes: 120,
      onWeeklyOff: false,
      onApprovedLeave: false
    },
    appliedOn: '2026-10-14'
  },
  {
    id: 'PRM-203',
    employeeId: 'EMP-103',
    employeeName: 'Priya Patel',
    date: '2026-10-19', // She is on approved leave on Oct 19! Demonstrates leave conflict flag!
    startTime: '11:00',
    endTime: '12:30',
    hours: 1.5,
    reason: 'Bank loan verification meeting',
    status: 'Pending',
    reviewer: null,
    reviewNote: '',
    flags: {
      overlapsShift: true,
      overlapMinutes: 90,
      onWeeklyOff: false,
      onApprovedLeave: true // Conflict flagged!
    },
    appliedOn: '2026-10-13'
  },
  {
    id: 'PRM-204',
    employeeId: 'EMP-104',
    employeeName: 'David Kim',
    date: '2026-10-20', // David Kim has Tuesday off! Demonstrates weekly off conflict flag!
    startTime: '14:00',
    endTime: '16:00',
    hours: 2,
    reason: 'Apartment inspection appointment',
    status: 'Pending',
    reviewer: null,
    reviewNote: '',
    flags: {
      overlapsShift: false,
      overlapMinutes: 0,
      onWeeklyOff: true, // Conflict flagged!
      onApprovedLeave: false
    },
    appliedOn: '2026-10-13'
  }
];

// Persistence Management
export class DataStore {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) {
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.POLICIES)) {
      localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(INITIAL_POLICIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PERMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(INITIAL_PERMISSIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVES)) {
      localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      // Default logged in as Sarah Chen (HR Admin)
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({
        employeeId: 'EMP-101',
        activeRole: 'HR Admin'
      }));
    }
  }

  getEmployees() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
  }

  saveEmployees(employees) {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  }

  getEmployeeById(id) {
    return this.getEmployees().find(e => e.id === id);
  }

  saveEmployee(employee) {
    const list = this.getEmployees();
    const index = list.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      list[index] = employee;
    } else {
      list.push(employee);
    }
    this.saveEmployees(list);
  }

  getPolicies() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.POLICIES) || JSON.stringify(INITIAL_POLICIES));
  }

  savePolicies(policies) {
    localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(policies));
  }

  getPermissions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PERMISSIONS) || '[]');
  }

  savePermissions(permissions) {
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions));
  }

  addPermission(request) {
    const list = this.getPermissions();
    list.unshift(request);
    this.savePermissions(list);
    return request;
  }

  updatePermission(id, updates) {
    const list = this.getPermissions();
    const index = list.findIndex(p => p.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...updates };
      this.savePermissions(list);
      return list[index];
    }
    return null;
  }

  getLeaves() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVES) || '[]');
  }

  saveLeaves(leaves) {
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
  }

  addLeave(leave) {
    const list = this.getLeaves();
    list.unshift(leave);
    this.saveLeaves(list);
    return leave;
  }

  updateLeave(id, updates) {
    const list = this.getLeaves();
    const index = list.findIndex(l => l.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...updates };
      this.saveLeaves(list);
      return list[index];
    }
    return null;
  }

  getCurrentUserSession() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || '{"employeeId":"EMP-101","activeRole":"HR Admin"}');
  }

  setCurrentUserSession(session) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));
  }

  resetAll() {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(INITIAL_EMPLOYEES));
    localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(INITIAL_POLICIES));
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(INITIAL_PERMISSIONS));
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(INITIAL_LEAVES));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({
      employeeId: 'EMP-101',
      activeRole: 'HR Admin'
    }));
  }
}
