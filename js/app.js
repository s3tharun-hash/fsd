// Main Application Controller
import {
  DataStore,
  DAYS_OF_WEEK,
  DEPARTMENTS
} from './data.js';

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
} from './scheduleEngine.js';

// Application State
class WorkPulseApp {
  constructor() {
    this.store = new DataStore();
    this.currentUser = null;
    this.activeTab = 'tab-directory';
    this.activeProfileEmployeeId = null;

    // Filters
    this.permFilter = 'all';
    this.leaveFilter = 'all';
    this.empSearchQuery = '';
    this.empSectorFilter = '';
    this.empOffFilter = '';

    // Modals state
    this.activeReviewPermissionId = null;
    this.activeReviewLeaveId = null;

    // Month Navigation & Calendar View State
    this.selectedYear = 2026;
    this.selectedMonth = 10; // 10 = October
    this.monthViewMode = 'cards'; // 'cards' | 'calendar'
    this.calEmployeeId = null;

    this.init();
  }

  init() {
    this.initCurrentUser();
    this.setupEventListeners();
    this.renderHeaderUserSelect();
    this.renderTopStats();
    this.renderEmployeeDirectory();
    this.renderPermissionsTab();
    this.renderLeavesTab();
    this.renderPoliciesTab();
    this.populateStaticDropdowns();
  }

  // Session & User Setup
  initCurrentUser() {
    const session = this.store.getCurrentUserSession();
    const employees = this.store.getEmployees();
    const found = employees.find(e => e.id === session.employeeId) || employees[0];
    this.currentUser = {
      ...found,
      activeRole: session.activeRole || found.role || 'HR Admin'
    };
    this.activeProfileEmployeeId = this.currentUser.id;
    this.updateUserBadgeUI();
  }

  updateUserBadgeUI() {
    const roleBadge = document.getElementById('currentUserRoleBadge');
    if (roleBadge) {
      roleBadge.textContent = this.currentUser.activeRole;
      roleBadge.className = `role-pill ${this.currentUser.activeRole === 'HR Admin' ? 'admin' : 'employee'}`;
    }

    // Toggle HR Admin only buttons
    const isAdmin = this.currentUser.activeRole === 'HR Admin';
    const btnAddEmp = document.getElementById('btnAddNewEmployee');
    const btnEditEmp = document.getElementById('btnEditCurrentEmployee');
    if (btnAddEmp) btnAddEmp.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnEditEmp) btnEditEmp.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  renderHeaderUserSelect() {
    const select = document.getElementById('currentUserSelect');
    if (!select) return;
    const employees = this.store.getEmployees();

    select.innerHTML = employees.map(emp => {
      const isSelected = emp.id === this.currentUser.id ? 'selected' : '';
      return `<option value="${emp.id}" ${isSelected}>${emp.name} (${emp.role})</option>`;
    }).join('');

    select.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const emp = this.store.getEmployeeById(selectedId);
      if (emp) {
        this.currentUser = {
          ...emp,
          activeRole: emp.role || 'Employee'
        };
        this.store.setCurrentUserSession({
          employeeId: emp.id,
          activeRole: this.currentUser.activeRole
        });
        this.activeProfileEmployeeId = emp.id;
        this.updateUserBadgeUI();
        this.renderAllViews();
        this.showToast(`Switched active user to ${emp.name} (${this.currentUser.activeRole})`, 'info');
      }
    });
  }

  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Theme toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      this.showToast(`Switched to ${next} mode`, 'info');
    });

    // Employee filters
    document.getElementById('empSearchInput')?.addEventListener('input', (e) => {
      this.empSearchQuery = e.target.value.toLowerCase().trim();
      this.renderEmployeeDirectory();
    });

    document.getElementById('empSectorFilter')?.addEventListener('change', (e) => {
      this.empSectorFilter = e.target.value;
      this.renderEmployeeDirectory();
    });

    document.getElementById('empOffFilter')?.addEventListener('change', (e) => {
      this.empOffFilter = e.target.value;
      this.renderEmployeeDirectory();
    });

    // Add Employee button
    document.getElementById('btnAddNewEmployee')?.addEventListener('click', () => {
      this.openEmployeeModal(null);
    });

    // Save Employee Form
    document.getElementById('btnSaveEmployeeSubmit')?.addEventListener('click', () => {
      this.handleSaveEmployee();
    });

    // Profile actions
    document.getElementById('btnProfileNewPerm')?.addEventListener('click', () => {
      this.openPermissionModal(this.activeProfileEmployeeId);
    });

    document.getElementById('btnProfileNewLeave')?.addEventListener('click', () => {
      this.openLeaveModal(this.activeProfileEmployeeId);
    });

    document.getElementById('btnEditCurrentEmployee')?.addEventListener('click', () => {
      this.openEmployeeModal(this.activeProfileEmployeeId);
    });

    // Permission filters & modal
    document.getElementById('btnOpenPermissionModal')?.addEventListener('click', () => {
      this.openPermissionModal(this.currentUser.id);
    });

    document.querySelectorAll('[data-perm-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-perm-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.permFilter = btn.getAttribute('data-perm-filter');
        this.renderPermissionsTable();
      });
    });

    document.getElementById('permEmployeeFilter')?.addEventListener('change', (e) => {
      this.renderPermissionsTable();
    });

    // Permission Form Live Overlap & Conflict Checkers
    ['permFormEmployee', 'permFormDate', 'permFormStartTime', 'permFormEndTime'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.runLivePermissionConflictCheck();
      });
      document.getElementById(id)?.addEventListener('input', () => {
        this.runLivePermissionConflictCheck();
      });
    });

    // Submit Permission
    document.getElementById('btnSubmitPermission')?.addEventListener('click', () => {
      this.handleSubmitPermission();
    });

    // Permission Review buttons
    document.getElementById('btnApprovePermission')?.addEventListener('click', () => {
      this.handleReviewPermission('Approved');
    });

    document.getElementById('btnRejectPermission')?.addEventListener('click', () => {
      this.handleReviewPermission('Rejected');
    });

    // Leave filters & modal
    document.getElementById('btnOpenLeaveModal')?.addEventListener('click', () => {
      this.openLeaveModal(this.currentUser.id);
    });

    document.querySelectorAll('[data-leave-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-leave-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.leaveFilter = btn.getAttribute('data-leave-filter');
        this.renderLeavesTable();
      });
    });

    document.getElementById('leaveEmployeeFilter')?.addEventListener('change', () => {
      this.renderLeavesTable();
    });

    // Leave Form Live Balance Impact Checkers
    ['leaveFormEmployee', 'leaveFormStartDate', 'leaveFormEndDate', 'leaveFormType'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.runLiveLeaveImpactCheck();
      });
      document.getElementById(id)?.addEventListener('input', () => {
        this.runLiveLeaveImpactCheck();
      });
    });

    // Submit Leave
    document.getElementById('btnSubmitLeave')?.addEventListener('click', () => {
      this.handleSubmitLeave();
    });

    // Leave Review buttons
    document.getElementById('btnApproveLeave')?.addEventListener('click', () => {
      this.handleReviewLeave('Approved');
    });

    document.getElementById('btnRejectLeave')?.addEventListener('click', () => {
      this.handleReviewLeave('Rejected');
    });

    // Policies tab actions
    document.getElementById('policyDeductToggle')?.addEventListener('change', (e) => {
      const wrap = document.getElementById('policyDeductConversionWrap');
      if (wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('btnSaveDeductPolicy')?.addEventListener('click', () => {
      this.handleSaveDeductPolicy();
    });

    document.getElementById('btnSaveScheduleDefaults')?.addEventListener('click', () => {
      this.handleSaveScheduleDefaults();
    });

    document.getElementById('btnResetData')?.addEventListener('click', () => {
      if (confirm('Reset all demo data to default initial state?')) {
        this.store.resetAll();
        this.initCurrentUser();
        this.renderAllViews();
        this.showToast('Demo data reset to factory initial state', 'success');
      }
    });

    // Month Navigator & Calendar Controls
    document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
      this.changeMonth(-1);
    });

    document.getElementById('btnNextMonth')?.addEventListener('click', () => {
      this.changeMonth(1);
    });

    document.getElementById('btnViewModeCards')?.addEventListener('click', () => {
      this.setMonthViewMode('cards');
    });

    document.getElementById('btnViewModeCalendar')?.addEventListener('click', () => {
      this.setMonthViewMode('calendar');
    });

    document.getElementById('calEmployeeSelect')?.addEventListener('change', (e) => {
      this.calEmployeeId = e.target.value;
      this.renderInteractiveCalendar();
    });

    document.getElementById('btnExportMonthlyReport')?.addEventListener('click', () => {
      this.exportMonthlyReport();
    });

    // Modal Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });

    // Modal backdrop clicks
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      const isTarget = section.id === tabId;
      section.classList.toggle('active', isTarget);
      section.style.display = isTarget ? 'block' : 'none';
    });

    if (tabId === 'tab-directory') this.renderEmployeeDirectory();
    if (tabId === 'tab-profile') this.renderProfileView();
    if (tabId === 'tab-permissions') this.renderPermissionsTab();
    if (tabId === 'tab-leaves') this.renderLeavesTab();
    if (tabId === 'tab-policies') this.renderPoliciesTab();
  }

  renderAllViews() {
    this.renderTopStats();
    this.renderEmployeeDirectory();
    this.renderProfileView();
    this.renderPermissionsTab();
    this.renderLeavesTab();
    this.renderPoliciesTab();
  }

  // Populate Dropdowns
  populateStaticDropdowns() {
    const sectorFilter = document.getElementById('empSectorFilter');
    const empFormSector = document.getElementById('empFormSector');
    if (sectorFilter && empFormSector) {
      const optionsHtml = DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('');
      sectorFilter.innerHTML = '<option value="">All Sectors / Departments</option>' + optionsHtml;
      empFormSector.innerHTML = optionsHtml;
    }
  }

  // Top Stats Summary
  renderTopStats() {
    const employees = this.store.getEmployees();
    const permissions = this.store.getPermissions();
    const leaves = this.store.getLeaves();
    const policy = this.store.getPolicies();

    const pendingPerms = permissions.filter(p => p.status === 'Pending');
    const pendingLeaves = leaves.filter(l => l.status === 'Pending');
    const conflictPerms = permissions.filter(p => p.flags && (p.flags.onWeeklyOff || p.flags.onApprovedLeave));

    document.getElementById('statTotalEmployees').textContent = employees.length;
    document.getElementById('statPendingPermissions').textContent = pendingPerms.length;
    document.getElementById('statConflictPermissions').textContent = `${conflictPerms.length} flagged conflict(s)`;
    document.getElementById('statPendingLeaves').textContent = pendingLeaves.length;

    const badgePerm = document.getElementById('pendingPermBadge');
    if (badgePerm) {
      badgePerm.textContent = pendingPerms.length;
      badgePerm.className = `tab-badge ${pendingPerms.length > 0 ? 'badge-alert' : ''}`;
    }

    const badgeLeave = document.getElementById('pendingLeaveBadge');
    if (badgeLeave) {
      badgeLeave.textContent = pendingLeaves.length;
      badgeLeave.className = `tab-badge ${pendingLeaves.length > 0 ? 'badge-alert' : ''}`;
    }

    const statPolicyState = document.getElementById('statPolicyState');
    const statPolicySubtext = document.getElementById('statPolicySubtext');
    if (statPolicyState && statPolicySubtext) {
      if (policy.deductPermissionFromMonthlyLeave) {
        statPolicyState.textContent = 'Active Deduction';
        statPolicyState.style.color = 'var(--warning)';
        statPolicySubtext.textContent = `${policy.permissionHoursPerLeaveDay}h permission = 1 leave day`;
      } else {
        statPolicyState.textContent = 'Separate Balances';
        statPolicyState.style.color = 'var(--accent-cyan)';
        statPolicySubtext.textContent = 'Permissions do not reduce leave';
      }
    }
  }

  // TAB 1: EMPLOYEE DIRECTORY
  renderEmployeeDirectory() {
    const grid = document.getElementById('employeeCardsGrid');
    if (!grid) return;

    let employees = this.store.getEmployees();
    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();
    const isAdmin = this.currentUser.activeRole === 'HR Admin';

    // Filters
    if (this.empSearchQuery) {
      employees = employees.filter(e =>
        e.name.toLowerCase().includes(this.empSearchQuery) ||
        e.sector.toLowerCase().includes(this.empSearchQuery) ||
        e.teamLead.toLowerCase().includes(this.empSearchQuery)
      );
    }
    if (this.empSectorFilter) {
      employees = employees.filter(e => e.sector === this.empSectorFilter);
    }
    if (this.empOffFilter === 'weekend') {
      employees = employees.filter(e => {
        const offs = (e.weeklyOffDays || []).slice().sort().join(',');
        return offs === '0,6';
      });
    } else if (this.empOffFilter === 'custom') {
      employees = employees.filter(e => {
        const offs = (e.weeklyOffDays || []).slice().sort().join(',');
        return offs !== '0,6';
      });
    }

    if (employees.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3 style="font-weight: 700;">No employees found</h3>
          <p style="font-size: 0.85rem; margin-top: 0.35rem;">Try modifying your search or filter criteria.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = employees.map(emp => {
      const summary = getEmployeeMonthSummary(emp, leaves, permissions, policy, '2026-10');
      const offDayNames = getWeeklyOffDayNames(emp.weeklyOffDays);
      const isDefaultOff = (emp.weeklyOffDays || []).slice().sort().join(',') === '0,6';

      const offPillsHtml = offDayNames.map(name => `<span class="off-pill">${name}</span>`).join('');
      const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      return `
        <div class="employee-card" data-emp-id="${emp.id}">
          <div>
            <div class="emp-header">
              <div class="emp-avatar" style="background: ${emp.avatarBg || 'var(--primary)'};">
                ${initials}
              </div>
              <div class="emp-info">
                <h3>${emp.name}</h3>
                <span class="emp-dept-badge">${emp.sector}</span>
              </div>
            </div>

            <div class="emp-details-list">
              <div class="detail-row">
                <span class="detail-label">👔 Team Lead:</span>
                <span class="detail-value">${emp.teamLead}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏰ Shift Hours:</span>
                <span class="shift-badge">
                  ${formatTime12(emp.shiftStart)} - ${formatTime12(emp.shiftEnd)}
                  <small style="opacity: 0.7;">(${emp.shiftStart} - ${emp.shiftEnd})</small>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🏖️ Weekly Off:</span>
                <div class="weekly-off-pills">
                  ${offPillsHtml}
                  ${!isDefaultOff ? '<span class="off-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border-color: rgba(99, 102, 241, 0.3);">Custom</span>' : ''}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="emp-card-footer">
              <div class="balance-mini-tag">
                Leave Bal: <strong>${summary.remainingLeaveBalance}d</strong>
                <span style="opacity: 0.5;">|</span>
                Perm: <strong>${summary.permissionHoursUsed}h</strong>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm" onclick="window.app.viewEmployeeProfile('${emp.id}')">
                  Profile
                </button>
                ${isAdmin ? `
                  <button class="btn btn-primary btn-sm" onclick="window.app.openEmployeeModal('${emp.id}')">
                    Manage
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // TAB 2: EMPLOYEE PROFILE
  renderProfileView() {
    const emp = this.store.getEmployeeById(this.activeProfileEmployeeId) || this.currentUser;
    if (!emp) return;

    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();
    const summary = getEmployeeMonthSummary(emp, leaves, permissions, policy, '2026-10');
    const isAdmin = this.currentUser.activeRole === 'HR Admin';

    // Render Hero
    const hero = document.getElementById('profileHeroContainer');
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isDefaultOff = (emp.weeklyOffDays || []).slice().sort().join(',') === '0,6';

    if (hero) {
      hero.innerHTML = `
        <div class="profile-hero-left">
          <div class="profile-avatar-large" style="background: ${emp.avatarBg || 'var(--primary)'};">
            ${initials}
          </div>
          <div class="profile-hero-info">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <h2>${emp.name}</h2>
              <span class="role-pill ${emp.role === 'HR Admin' ? 'admin' : 'employee'}">${emp.role}</span>
              <span class="emp-dept-badge">${emp.sector}</span>
            </div>
            <p>
              <strong>Email:</strong> ${emp.email || 'N/A'} &nbsp;•&nbsp; 
              <strong>Team Lead:</strong> ${emp.teamLead} &nbsp;•&nbsp; 
              <strong>Employee ID:</strong> <span style="font-family: var(--font-mono);">${emp.id}</span>
            </p>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">Scheduled Daily Shift</div>
          <div class="shift-badge" style="font-size: 0.95rem; margin-top: 0.35rem; padding: 0.35rem 0.85rem;">
            ${formatTime12(emp.shiftStart)} - ${formatTime12(emp.shiftEnd)}
            <small style="opacity: 0.7;">(${emp.shiftStart} - ${emp.shiftEnd})</small>
          </div>
        </div>
      `;
    }

    // Weekly Schedule Bar
    const roster = document.getElementById('profileWeeklyScheduleRoster');
    const rosterBadge = document.getElementById('profileWeeklyOffBadge');
    if (rosterBadge) {
      rosterBadge.textContent = isDefaultOff ? 'Default Sat & Sun Off' : 'Custom Weekly Off Schedule';
      rosterBadge.className = `status-pill ${isDefaultOff ? 'status-approved' : 'status-pending'}`;
    }

    if (roster) {
      // Order days from Monday (1) to Sunday (0)
      const orderedDays = [1, 2, 3, 4, 5, 6, 0];
      roster.innerHTML = orderedDays.map(dayId => {
        const dayMeta = DAYS_OF_WEEK.find(d => d.id === dayId);
        const isOff = (emp.weeklyOffDays || []).includes(dayId);
        return `
          <div class="day-schedule-card ${isOff ? 'is-off' : 'is-work'}">
            <div class="day-name">${dayMeta.short}</div>
            ${isOff
              ? '<div class="day-off-label">WEEKLY OFF</div>'
              : `<div class="day-shift-time">${emp.shiftStart} - ${emp.shiftEnd}</div>`
            }
          </div>
        `;
      }).join('');
    }

    // Balances Cards Grid
    const balancesGrid = document.getElementById('profileBalancesGrid');
    if (balancesGrid) {
      balancesGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Monthly Allowance</span>
            <div class="stat-icon primary">📅</div>
          </div>
          <div class="stat-value">${summary.allowance} <span style="font-size: 1rem; font-weight: 500;">days</span></div>
          <div class="stat-subtext">October 2026 configured quota</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Leave Taken</span>
            <div class="stat-icon emerald">🏖️</div>
          </div>
          <div class="stat-value">${summary.leaveDaysTaken} <span style="font-size: 1rem; font-weight: 500;">days</span></div>
          <div class="stat-subtext">Excludes weekly off days</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Remaining Balance</span>
            <div class="stat-icon cyan">✨</div>
          </div>
          <div class="stat-value" style="color: var(--success);">${summary.remainingLeaveBalance} <span style="font-size: 1rem; font-weight: 500;">days</span></div>
          <div class="stat-subtext">Available for October 2026</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Permission Time Used</span>
            <div class="stat-icon amber">⏱️</div>
          </div>
          <div class="stat-value">${summary.permissionHoursUsed} <span style="font-size: 1rem; font-weight: 500;">hours</span></div>
          <div class="stat-subtext">
            ${summary.policyDeductEnabled 
              ? `⚠️ Policy active: -${summary.permissionLeaveDeduction}d deducted (${summary.conversionRatio}h = 1d)`
              : 'Independent balance (No leave deduction)'
            }
          </div>
        </div>
      `;
    }

    // Recent Permissions for this profile
    const profilePerms = permissions.filter(p => p.employeeId === emp.id);
    const permListContainer = document.getElementById('profileRecentPermissionsList');
    const permCount = document.getElementById('profilePermCount');
    if (permCount) permCount.textContent = `${profilePerms.length} total`;

    if (permListContainer) {
      if (profilePerms.length === 0) {
        permListContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem; padding: 1rem 0;">No permission requests submitted yet.</div>';
      } else {
        permListContainer.innerHTML = profilePerms.map(p => {
          const statusClass = p.status === 'Approved' ? 'status-approved' : p.status === 'Rejected' ? 'status-rejected' : 'status-pending';
          return `
            <div style="background: var(--bg-surface-elevated); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600; font-size: 0.88rem;">${formatDate(p.date)} (${formatTime12(p.startTime)} - ${formatTime12(p.endTime)})</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${p.reason}</div>
              </div>
              <div style="text-align: right;">
                <span class="status-pill ${statusClass}">${p.status}</span>
                <div style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600; margin-top: 0.25rem;">${p.hours} hrs</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Recent Leaves for this profile
    const profileLeaves = leaves.filter(l => l.employeeId === emp.id);
    const leaveListContainer = document.getElementById('profileRecentLeavesList');
    const leaveCount = document.getElementById('profileLeaveCount');
    if (leaveCount) leaveCount.textContent = `${profileLeaves.length} total`;

    if (leaveListContainer) {
      if (profileLeaves.length === 0) {
        leaveListContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem; padding: 1rem 0;">No leave requests applied yet.</div>';
      } else {
        leaveListContainer.innerHTML = profileLeaves.map(l => {
          const statusClass = l.status === 'Approved' ? 'status-approved' : l.status === 'Rejected' ? 'status-rejected' : 'status-pending';
          const excludedText = l.excludedDates && l.excludedDates.length > 0 ? ` (${l.excludedDates.length} weekly off days excluded)` : '';
          return `
            <div style="background: var(--bg-surface-elevated); padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600; font-size: 0.88rem;">${formatDate(l.startDate)} - ${formatDate(l.endDate)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem;">${l.type}: ${l.reason}</div>
              </div>
              <div style="text-align: right;">
                <span class="status-pill ${statusClass}">${l.status}</span>
                <div style="font-size: 0.75rem; color: var(--success); font-weight: 600; margin-top: 0.25rem;">${l.requestedDays} Net Days${excludedText}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  viewEmployeeProfile(empId) {
    this.activeProfileEmployeeId = empId;
    this.switchTab('tab-profile');
  }

  // TAB 3: PERMISSIONS
  renderPermissionsTab() {
    this.populatePermissionEmployeeFilter();
    this.renderPermissionsTable();
  }

  populatePermissionEmployeeFilter() {
    const filter = document.getElementById('permEmployeeFilter');
    if (!filter) return;
    const employees = this.store.getEmployees();
    const currentVal = filter.value;
    filter.innerHTML = '<option value="">All Employees</option>' +
      employees.map(e => `<option value="${e.id}" ${e.id === currentVal ? 'selected' : ''}>${e.name}</option>`).join('');
  }

  renderPermissionsTable() {
    const tbody = document.getElementById('permissionsTableBody');
    if (!tbody) return;

    let permissions = this.store.getPermissions();
    const empFilter = document.getElementById('permEmployeeFilter')?.value;
    const isAdmin = this.currentUser.activeRole === 'HR Admin';

    if (empFilter) {
      permissions = permissions.filter(p => p.employeeId === empFilter);
    }

    if (this.permFilter === 'pending') {
      permissions = permissions.filter(p => p.status === 'Pending');
    } else if (this.permFilter === 'approved') {
      permissions = permissions.filter(p => p.status === 'Approved');
    } else if (this.permFilter === 'rejected') {
      permissions = permissions.filter(p => p.status === 'Rejected');
    } else if (this.permFilter === 'conflict') {
      permissions = permissions.filter(p => p.flags && (p.flags.onWeeklyOff || p.flags.onApprovedLeave));
    }

    if (permissions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No permission requests match the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = permissions.map(p => {
      const statusClass = p.status === 'Approved' ? 'status-approved' : p.status === 'Rejected' ? 'status-rejected' : 'status-pending';
      const flags = p.flags || {};

      // Build flag tags
      const flagTags = [];
      if (flags.overlapsShift) {
        flagTags.push(`<span class="flag-banner flag-info" title="Overlaps regular shift by ${minutesToHoursStr(flags.overlapMinutes || 0)}">⚡ Overlaps Shift (${minutesToHoursStr(flags.overlapMinutes || 0)})</span>`);
      } else {
        flagTags.push(`<span class="flag-banner flag-warning" title="Outside regular shift hours">🌙 Outside Shift</span>`);
      }

      if (flags.onApprovedLeave) {
        flagTags.push(`<span class="flag-banner flag-danger" title="Falls on an approved leave day">⚠️ Conflict: Approved Leave</span>`);
      }

      if (flags.onWeeklyOff) {
        flagTags.push(`<span class="flag-banner flag-danger" title="Falls on a scheduled weekly off day">⚠️ Conflict: Weekly Off Day</span>`);
      }

      const reviewNoteHtml = p.reviewer 
        ? `<div style="font-size: 0.8rem;"><strong>${p.reviewer}</strong>: <span style="color: var(--text-muted);">${p.reviewNote || 'No notes added'}</span></div>`
        : '<span style="color: var(--text-dim); font-size: 0.8rem;">Awaiting review</span>';

      return `
        <tr>
          <td>
            <div style="font-weight: 700;">${p.employeeName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.employeeId}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${formatDate(p.date)}</div>
          </td>
          <td>
            <div class="shift-badge" style="font-size: 0.78rem;">
              ${formatTime12(p.startTime)} - ${formatTime12(p.endTime)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Duration: ${p.hours} hrs</div>
          </td>
          <td style="max-width: 200px;">
            <div style="font-size: 0.82rem; line-height: 1.3;">${p.reason}</div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              ${flagTags.join('')}
            </div>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${p.status}</span>
          </td>
          <td>
            ${reviewNoteHtml}
          </td>
          <td>
            ${isAdmin && p.status === 'Pending' ? `
              <button class="btn btn-primary btn-sm" onclick="window.app.openPermissionReviewModal('${p.id}')">
                Review
              </button>
            ` : isAdmin ? `
              <button class="btn btn-secondary btn-sm" onclick="window.app.openPermissionReviewModal('${p.id}')">
                Details
              </button>
            ` : p.employeeId === this.currentUser.id && p.status === 'Pending' ? `
              <button class="btn btn-danger btn-sm" onclick="window.app.cancelPermission('${p.id}')">
                Cancel
              </button>
            ` : '<span style="font-size: 0.8rem; color: var(--text-dim);">—</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  getMonthYearStr() {
    const m = String(this.selectedMonth).padStart(2, '0');
    return `${this.selectedYear}-${m}`;
  }

  getMonthName() {
    const d = new Date(this.selectedYear, this.selectedMonth - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  changeMonth(delta) {
    this.selectedMonth += delta;
    if (this.selectedMonth > 12) {
      this.selectedMonth = 1;
      this.selectedYear += 1;
    } else if (this.selectedMonth < 1) {
      this.selectedMonth = 12;
      this.selectedYear -= 1;
    }
    this.renderLeavesTab();
    this.showToast(`Showing records for ${this.getMonthName()}`, 'info');
  }

  setMonthViewMode(mode) {
    this.monthViewMode = mode;
    const btnCards = document.getElementById('btnViewModeCards');
    const btnCal = document.getElementById('btnViewModeCalendar');
    const cardsWrap = document.getElementById('allEmpLeaveCardsContainer');
    const calWrap = document.getElementById('monthCalendarContainer');

    if (btnCards) btnCards.classList.toggle('active', mode === 'cards');
    if (btnCal) btnCal.classList.toggle('active', mode === 'calendar');

    if (cardsWrap) cardsWrap.style.display = mode === 'cards' ? 'block' : 'none';
    if (calWrap) calWrap.style.display = mode === 'calendar' ? 'block' : 'none';

    if (mode === 'calendar') {
      this.renderInteractiveCalendar();
    }
  }

  // TAB 4: MONTHLY LEAVE TRACKER & CALCULATOR
  renderLeavesTab() {
    const monthTitle = document.getElementById('monthDisplayTitle');
    const cardsHeading = document.getElementById('cardsBoardMonthHeading');
    const monthYearText = this.getMonthName();

    if (monthTitle) monthTitle.textContent = monthYearText;
    if (cardsHeading) cardsHeading.textContent = `${monthYearText} Monthly Leave Balances`;

    this.populateLeaveEmployeeFilter();
    this.renderAllEmpLeaveBalanceCards();
    this.renderLeavesTable();

    if (this.monthViewMode === 'calendar') {
      this.renderInteractiveCalendar();
    }
  }

  populateLeaveEmployeeFilter() {
    const filter = document.getElementById('leaveEmployeeFilter');
    if (!filter) return;
    const employees = this.store.getEmployees();
    const currentVal = filter.value;
    filter.innerHTML = '<option value="">All Employees</option>' +
      employees.map(e => `<option value="${e.id}" ${e.id === currentVal ? 'selected' : ''}>${e.name}</option>`).join('');
  }

  renderAllEmpLeaveBalanceCards() {
    const container = document.getElementById('allEmpLeaveBalanceCards');
    if (!container) return;

    const employees = this.store.getEmployees();
    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();
    const monthYear = this.getMonthYearStr();

    container.innerHTML = employees.map(emp => {
      const summary = getEmployeeMonthSummary(emp, leaves, permissions, policy, monthYear);
      const offNames = getWeeklyOffDayNames(emp.weeklyOffDays).join(', ');

      return `
        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 700;">${emp.name}</h4>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${emp.sector}</span>
            </div>
            <div style="text-align: right;">
              <span class="status-pill status-approved" style="font-size: 0.72rem;">${summary.remainingLeaveBalance}d Bal</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; background: var(--bg-surface); padding: 0.5rem; border-radius: var(--radius-sm); text-align: center; font-size: 0.75rem;">
            <div>
              <div style="color: var(--text-muted);">Quota</div>
              <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">${summary.allowance}d</div>
            </div>
            <div>
              <div style="color: var(--text-muted);">Taken</div>
              <div style="font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem;">${summary.leaveDaysTaken}d</div>
            </div>
            <div>
              <div style="color: var(--text-muted);">Perms</div>
              <div style="font-weight: 700; color: var(--warning); font-size: 0.9rem;">${summary.permissionHoursUsed}h</div>
            </div>
          </div>

          <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.5rem;">
            🏖️ Off Days: <span style="color: #fda4af;">${offNames}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderInteractiveCalendar() {
    const grid = document.getElementById('calendarDaysGrid');
    const select = document.getElementById('calEmployeeSelect');
    if (!grid) return;

    const employees = this.store.getEmployees();
    if (!this.calEmployeeId) {
      this.calEmployeeId = this.currentUser.id || employees[0].id;
    }

    if (select) {
      select.innerHTML = employees.map(e => `
        <option value="${e.id}" ${e.id === this.calEmployeeId ? 'selected' : ''}>${e.name} (${e.sector})</option>
      `).join('');
    }

    const emp = this.store.getEmployeeById(this.calEmployeeId);
    if (!emp) return;

    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();

    const year = this.selectedYear;
    const monthIndex = this.selectedMonth - 1; // 0-indexed
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let cellsHtml = '';

    // Leading empty days
    for (let i = 0; i < firstDayOfWeek; i++) {
      cellsHtml += '<div class="calendar-day-cell is-other-month"></div>';
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDateStr = `${year}-${String(this.selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
      const isOff = (emp.weeklyOffDays || []).includes(dayOfWeek);

      // Check approved leaves covering this date
      const activeLeave = leaves.find(l => {
        if (l.employeeId !== emp.id || l.status !== 'Approved') return false;
        return dayDateStr >= l.startDate && dayDateStr <= l.endDate;
      });

      // Check permissions on this date
      const dayPerms = permissions.filter(p => p.employeeId === emp.id && p.date === dayDateStr);

      const events = [];

      if (isOff) {
        events.push('<span class="cal-badge badge-off">🏖️ WEEKLY OFF</span>');
      } else {
        events.push(`<span class="cal-badge badge-shift">${emp.shiftStart}-${emp.shiftEnd}</span>`);
      }

      if (activeLeave) {
        events.push(`<span class="cal-badge badge-leave">🏖️ ${activeLeave.type}</span>`);
      }

      dayPerms.forEach(p => {
        const flagIcon = (p.flags && (p.flags.onWeeklyOff || p.flags.onApprovedLeave)) ? '⚠️ ' : '⏱️ ';
        events.push(`<span class="cal-badge badge-perm" title="${p.reason}">${flagIcon}${p.startTime}-${p.endTime} (${p.hours}h) [${p.status}]</span>`);
      });

      const isToday = dayDateStr === '2026-10-14';

      cellsHtml += `
        <div class="calendar-day-cell ${isOff ? 'is-weekly-off' : ''} ${isToday ? 'is-today' : ''}" 
             title="Click to request permission or leave for this date"
             onclick="window.app.quickBookDay('${dayDateStr}', '${emp.id}')">
          <div class="cal-day-top">
            <span class="cal-day-number">${day}</span>
            ${isToday ? '<span style="font-size: 0.65rem; color: var(--primary); font-weight: 700;">TODAY</span>' : ''}
          </div>
          <div class="cal-events-stack">
            ${events.join('')}
          </div>
        </div>
      `;
    }

    grid.innerHTML = cellsHtml;
  }

  quickBookDay(dateStr, empId) {
    if (this.currentUser.activeRole !== 'HR Admin' && this.currentUser.id !== empId) {
      return;
    }
    const choice = confirm(`Manage actions for ${dateStr} (${this.store.getEmployeeById(empId)?.name}):\n\nClick OK to Request Permission, or Cancel to Apply for Leave.`);
    if (choice) {
      this.openPermissionModal(empId);
      document.getElementById('permFormDate').value = dateStr;
      this.runLivePermissionConflictCheck();
    } else {
      this.openLeaveModal(empId);
      document.getElementById('leaveFormStartDate').value = dateStr;
      document.getElementById('leaveFormEndDate').value = dateStr;
      this.runLiveLeaveImpactCheck();
    }
  }

  exportMonthlyReport() {
    const employees = this.store.getEmployees();
    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();
    const monthYear = this.getMonthYearStr();

    const headers = [
      'Employee ID',
      'Name',
      'Department / Sector',
      'Team Lead',
      'Shift Start',
      'Shift End',
      'Weekly Off Days',
      'Month',
      'Monthly Allowance (Days)',
      'Leave Taken (Days)',
      'Remaining Leave Balance (Days)',
      'Approved Permission Hours'
    ];

    const rows = employees.map(emp => {
      const summary = getEmployeeMonthSummary(emp, leaves, permissions, policy, monthYear);
      const offNames = getWeeklyOffDayNames(emp.weeklyOffDays).join(' & ');
      return [
        `"${emp.id}"`,
        `"${emp.name}"`,
        `"${emp.sector}"`,
        `"${emp.teamLead}"`,
        `"${emp.shiftStart}"`,
        `"${emp.shiftEnd}"`,
        `"${offNames}"`,
        `"${monthYear}"`,
        summary.allowance,
        summary.leaveDaysTaken,
        summary.remainingLeaveBalance,
        summary.permissionHoursUsed
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WorkPulse_Leave_Schedule_Report_${monthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast(`Exported monthly report for ${this.getMonthName()}`, 'success');
  }

  renderLeavesTable() {
    const tbody = document.getElementById('leavesTableBody');
    if (!tbody) return;

    let leaves = this.store.getLeaves();
    const empFilter = document.getElementById('leaveEmployeeFilter')?.value;
    const isAdmin = this.currentUser.activeRole === 'HR Admin';

    if (empFilter) {
      leaves = leaves.filter(l => l.employeeId === empFilter);
    }

    if (this.leaveFilter === 'pending') {
      leaves = leaves.filter(l => l.status === 'Pending');
    } else if (this.leaveFilter === 'approved') {
      leaves = leaves.filter(l => l.status === 'Approved');
    } else if (this.leaveFilter === 'rejected') {
      leaves = leaves.filter(l => l.status === 'Rejected');
    }

    if (leaves.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No leave requests match the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = leaves.map(l => {
      const statusClass = l.status === 'Approved' ? 'status-approved' : l.status === 'Rejected' ? 'status-rejected' : 'status-pending';
      const excludedDates = l.excludedDates || [];

      const excludedHtml = excludedDates.length > 0
        ? `<div class="excluded-tags-row">
            ${excludedDates.map(d => `<span class="excluded-tag">${formatDate(d)} (Off)</span>`).join('')}
           </div>`
        : '<span style="color: var(--text-dim); font-size: 0.8rem;">None (No off days crossed)</span>';

      const reviewNoteHtml = l.reviewer
        ? `<div style="font-size: 0.8rem;"><strong>${l.reviewer}</strong>: <span style="color: var(--text-muted);">${l.reviewNote || 'No notes added'}</span></div>`
        : '<span style="color: var(--text-dim); font-size: 0.8rem;">Awaiting review</span>';

      return `
        <tr>
          <td>
            <div style="font-weight: 700;">${l.employeeName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${l.employeeId}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${formatDate(l.startDate)} - ${formatDate(l.endDate)}</div>
          </td>
          <td>
            <span class="status-pill status-pending" style="font-size: 0.72rem;">${l.type}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--success); font-size: 0.95rem;">
              ${l.requestedDays} Net Days
            </div>
          </td>
          <td>
            ${excludedHtml}
          </td>
          <td style="max-width: 180px;">
            <div style="font-size: 0.82rem; line-height: 1.3;">${l.reason}</div>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${l.status}</span>
          </td>
          <td>
            ${reviewNoteHtml}
          </td>
          <td>
            ${isAdmin && l.status === 'Pending' ? `
              <button class="btn btn-primary btn-sm" onclick="window.app.openLeaveReviewModal('${l.id}')">
                Review
              </button>
            ` : isAdmin ? `
              <button class="btn btn-secondary btn-sm" onclick="window.app.openLeaveReviewModal('${l.id}')">
                Details
              </button>
            ` : l.employeeId === this.currentUser.id && l.status === 'Pending' ? `
              <button class="btn btn-danger btn-sm" onclick="window.app.cancelLeave('${l.id}')">
                Cancel
              </button>
            ` : '<span style="font-size: 0.8rem; color: var(--text-dim);">—</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // TAB 5: HR POLICY & SETTINGS
  renderPoliciesTab() {
    const policy = this.store.getPolicies();

    const deductToggle = document.getElementById('policyDeductToggle');
    const deductWrap = document.getElementById('policyDeductConversionWrap');
    const deductHoursInput = document.getElementById('policyDeductHoursInput');
    const allowanceInput = document.getElementById('policyDefaultAllowanceInput');
    const offCheckboxGroup = document.getElementById('policyDefaultOffCheckboxes');

    if (deductToggle) deductToggle.checked = !!policy.deductPermissionFromMonthlyLeave;
    if (deductWrap) deductWrap.style.display = policy.deductPermissionFromMonthlyLeave ? 'block' : 'none';
    if (deductHoursInput) deductHoursInput.value = policy.permissionHoursPerLeaveDay || 8;
    if (allowanceInput) allowanceInput.value = policy.defaultMonthlyLeaveAllowance || 2.5;

    if (offCheckboxGroup) {
      // Order days: Sunday to Saturday
      offCheckboxGroup.innerHTML = DAYS_OF_WEEK.map(d => {
        const isChecked = (policy.defaultWeeklyOff || [0, 6]).includes(d.id);
        return `
          <label class="custom-checkbox-label">
            <input type="checkbox" name="policyWeeklyOff" value="${d.id}" ${isChecked ? 'checked' : ''}>
            ${d.name}
          </label>
        `;
      }).join('');
    }
  }

  handleSaveDeductPolicy() {
    const deductToggle = document.getElementById('policyDeductToggle');
    const deductHoursInput = document.getElementById('policyDeductHoursInput');

    const policy = this.store.getPolicies();
    policy.deductPermissionFromMonthlyLeave = deductToggle.checked;
    policy.permissionHoursPerLeaveDay = Math.max(1, parseFloat(deductHoursInput.value) || 8);

    this.store.savePolicies(policy);
    this.renderTopStats();
    this.renderProfileView();
    this.renderLeavesTab();
    this.showToast('Permission deduction policy updated successfully', 'success');
  }

  handleSaveScheduleDefaults() {
    const offCheckboxes = document.querySelectorAll('input[name="policyWeeklyOff"]:checked');
    const allowanceInput = document.getElementById('policyDefaultAllowanceInput');

    const selectedOffDays = Array.from(offCheckboxes).map(cb => parseInt(cb.value, 10));
    if (selectedOffDays.length === 0) {
      this.showToast('Please select at least one weekly off day', 'error');
      return;
    }

    const policy = this.store.getPolicies();
    policy.defaultWeeklyOff = selectedOffDays;
    policy.defaultMonthlyLeaveAllowance = parseFloat(allowanceInput.value) || 2.5;

    this.store.savePolicies(policy);
    this.renderTopStats();
    this.showToast('Default schedule & allowance saved', 'success');
  }

  // MODAL: ADD / EDIT EMPLOYEE
  openEmployeeModal(employeeId = null) {
    const modal = document.getElementById('modalEmployee');
    const title = document.getElementById('modalEmployeeTitle');
    const form = document.getElementById('formEmployee');
    const weeklyOffContainer = document.getElementById('empFormWeeklyOffCheckboxes');
    const policy = this.store.getPolicies();

    form.reset();

    let emp = null;
    if (employeeId) {
      emp = this.store.getEmployeeById(employeeId);
      title.textContent = `Edit Schedule & Details: ${emp.name}`;
      document.getElementById('empFormId').value = emp.id;
      document.getElementById('empFormName').value = emp.name;
      document.getElementById('empFormEmail').value = emp.email || '';
      document.getElementById('empFormSector').value = emp.sector;
      document.getElementById('empFormTeamLead').value = emp.teamLead;
      document.getElementById('empFormMonthlyAllowance').value = emp.monthlyAllowance || policy.defaultMonthlyLeaveAllowance;
      document.getElementById('empFormShiftStart').value = emp.shiftStart;
      document.getElementById('empFormShiftEnd').value = emp.shiftEnd;
    } else {
      title.textContent = 'Add New Employee';
      document.getElementById('empFormId').value = '';
      document.getElementById('empFormMonthlyAllowance').value = policy.defaultMonthlyLeaveAllowance;
      document.getElementById('empFormShiftStart').value = '09:00';
      document.getElementById('empFormShiftEnd').value = '18:00';
    }

    // Weekly Off Days checkboxes (default Saturday 6 & Sunday 0)
    const selectedOffs = emp ? emp.weeklyOffDays : (policy.defaultWeeklyOff || [0, 6]);
    weeklyOffContainer.innerHTML = DAYS_OF_WEEK.map(d => {
      const isChecked = selectedOffs.includes(d.id);
      return `
        <label class="custom-checkbox-label">
          <input type="checkbox" name="empWeeklyOff" value="${d.id}" ${isChecked ? 'checked' : ''}>
          ${d.name}
        </label>
      `;
    }).join('');

    this.openModal('modalEmployee');
  }

  handleSaveEmployee() {
    const id = document.getElementById('empFormId').value;
    const name = document.getElementById('empFormName').value.trim();
    const email = document.getElementById('empFormEmail').value.trim();
    const sector = document.getElementById('empFormSector').value;
    const teamLead = document.getElementById('empFormTeamLead').value.trim();
    const monthlyAllowance = parseFloat(document.getElementById('empFormMonthlyAllowance').value) || 2.5;
    const shiftStart = document.getElementById('empFormShiftStart').value;
    const shiftEnd = document.getElementById('empFormShiftEnd').value;

    const checkedBoxes = document.querySelectorAll('input[name="empWeeklyOff"]:checked');
    const weeklyOffDays = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));

    if (!name || !sector || !teamLead || !shiftStart || !shiftEnd) {
      this.showToast('Please fill all required fields (*)', 'error');
      return;
    }

    if (timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart)) {
      this.showToast('Shift end time must be after shift start time', 'error');
      return;
    }

    if (weeklyOffDays.length === 0) {
      this.showToast('Please select at least one weekly off day', 'error');
      return;
    }

    const employeeData = {
      id: id || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@acme.corp`,
      sector,
      teamLead,
      shiftStart,
      shiftEnd,
      weeklyOffDays,
      monthlyAllowance,
      role: id ? (this.store.getEmployeeById(id)?.role || 'Employee') : 'Employee',
      avatarBg: id ? (this.store.getEmployeeById(id)?.avatarBg || 'var(--primary)') : 'linear-gradient(135deg, #6366f1, #3b82f6)'
    };

    this.store.saveEmployee(employeeData);
    this.closeModal('modalEmployee');
    this.renderAllViews();
    this.showToast(`Employee "${name}" saved successfully`, 'success');
  }

  // MODAL: PERMISSION REQUEST (SHORT TIME AWAY)
  openPermissionModal(prefillEmpId = null) {
    const select = document.getElementById('permFormEmployee');
    const employees = this.store.getEmployees();

    select.innerHTML = employees.map(e => `
      <option value="${e.id}" ${e.id === prefillEmpId ? 'selected' : ''}>
        ${e.name} (${e.sector} · Shift: ${e.shiftStart} - ${e.shiftEnd})
      </option>
    `).join('');

    // Pre-fill today/tomorrow
    document.getElementById('permFormDate').value = '2026-10-15';
    document.getElementById('permFormStartTime').value = '10:00';
    document.getElementById('permFormEndTime').value = '12:00';
    document.getElementById('permFormReason').value = '';

    this.runLivePermissionConflictCheck();
    this.openModal('modalPermission');
  }

  runLivePermissionConflictCheck() {
    const feedbackBox = document.getElementById('permConflictCheckResult');
    if (!feedbackBox) return;

    const empId = document.getElementById('permFormEmployee').value;
    const dateStr = document.getElementById('permFormDate').value;
    const startStr = document.getElementById('permFormStartTime').value;
    const endStr = document.getElementById('permFormEndTime').value;

    const emp = this.store.getEmployeeById(empId);
    if (!emp || !dateStr || !startStr || !endStr) {
      feedbackBox.innerHTML = '';
      return;
    }

    const startMin = timeToMinutes(startStr);
    const endMin = timeToMinutes(endStr);

    if (endMin <= startMin) {
      feedbackBox.innerHTML = `
        <div class="conflict-alert danger">
          ❌ End time (${endStr}) must be later than start time (${startStr}).
        </div>
      `;
      return;
    }

    const durationMinutes = endMin - startMin;
    const durationHours = (durationMinutes / 60).toFixed(1);

    // 1. Check duplicate / conflicting permission on same date
    const allPerms = this.store.getPermissions();
    const dupCheck = checkDuplicatePermission(dateStr, startStr, endStr, emp.id, allPerms);

    // 2. Check shift overlap
    const shiftCheck = checkShiftOverlap(emp.shiftStart, emp.shiftEnd, startStr, endStr);

    // 3. Check weekly off conflict
    const weeklyOffCheck = isWeeklyOffDay(dateStr, emp.weeklyOffDays);

    // 4. Check approved leave conflict
    const allLeaves = this.store.getLeaves();
    const leaveCheck = checkLeaveConflict(dateStr, emp.id, allLeaves);

    const alerts = [];

    if (dupCheck.hasConflict) {
      const conf = dupCheck.conflictingRequests[0];
      alerts.push(`
        <div class="conflict-alert danger">
          <strong>🚫 Duplicate / Conflicting Request Detected:</strong> 
          Employee already has a permission request (${conf.startTime} - ${conf.endTime}, Status: ${conf.status}) on this date.
        </div>
      `);
    }

    if (shiftCheck.overlapsShift) {
      alerts.push(`
        <div class="conflict-alert info">
          <strong>⚡ Shift Overlap Detected:</strong> 
          Overlaps scheduled shift (${formatTime12(emp.shiftStart)} - ${formatTime12(emp.shiftEnd)}) by 
          <strong>${minutesToHoursStr(shiftCheck.overlapMinutes)}</strong>. 
          This overlap will be flagged for supervisor review.
        </div>
      `);
    } else {
      alerts.push(`
        <div class="conflict-alert warning">
          <strong>🌙 Outside Regular Shift:</strong> 
          Scheduled shift is ${formatTime12(emp.shiftStart)} - ${formatTime12(emp.shiftEnd)}. 
          Requested window falls outside normal shift hours.
        </div>
      `);
    }

    if (weeklyOffCheck.isOff) {
      alerts.push(`
        <div class="conflict-alert danger">
          <strong>⚠️ Weekly Off Conflict:</strong> 
          ${formatDate(dateStr)} is configured as a Weekly Off day (${weeklyOffCheck.dayName}) for this employee. 
          Reviewer resolution is required!
        </div>
      `);
    }

    if (leaveCheck.hasConflict) {
      alerts.push(`
        <div class="conflict-alert danger">
          <strong>⚠️ Approved Leave Conflict:</strong> 
          Employee already has an Approved Leave (${leaveCheck.conflictingLeave.type}) covering this date. 
          Reviewer resolution is required!
        </div>
      `);
    }

    feedbackBox.innerHTML = `
      <div style="background: var(--bg-surface-elevated); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 0.65rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600;">
          <span>Requested Duration: ${durationHours} hours (${durationMinutes} mins)</span>
          <span>Shift: ${emp.shiftStart} - ${emp.shiftEnd}</span>
        </div>
        ${alerts.join('')}
      </div>
    `;
  }

  handleSubmitPermission() {
    const empId = document.getElementById('permFormEmployee').value;
    const date = document.getElementById('permFormDate').value;
    const startTime = document.getElementById('permFormStartTime').value;
    const endTime = document.getElementById('permFormEndTime').value;
    const reason = document.getElementById('permFormReason').value.trim();

    const emp = this.store.getEmployeeById(empId);
    if (!emp || !date || !startTime || !endTime || !reason) {
      this.showToast('Please fill all permission request fields', 'error');
      return;
    }

    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      this.showToast('End time must be after start time', 'error');
      return;
    }

    // Verify duplicate / conflict on same date
    const allPerms = this.store.getPermissions();
    const dupCheck = checkDuplicatePermission(date, startTime, endTime, emp.id, allPerms);
    if (dupCheck.hasConflict) {
      this.showToast('Cannot submit: A conflicting permission already exists on this date', 'error');
      return;
    }

    // Evaluate shift overlap & flags
    const shiftCheck = checkShiftOverlap(emp.shiftStart, emp.shiftEnd, startTime, endTime);
    const weeklyOffCheck = isWeeklyOffDay(date, emp.weeklyOffDays);
    const leaveCheck = checkLeaveConflict(date, emp.id, this.store.getLeaves());

    const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
    const hours = parseFloat((durationMinutes / 60).toFixed(2));

    const newRequest = {
      id: `PRM-${Math.floor(200 + Math.random() * 800)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      date,
      startTime,
      endTime,
      hours,
      reason,
      status: 'Pending',
      reviewer: null,
      reviewNote: '',
      flags: {
        overlapsShift: shiftCheck.overlapsShift,
        overlapMinutes: shiftCheck.overlapMinutes,
        onWeeklyOff: weeklyOffCheck.isOff,
        onApprovedLeave: leaveCheck.hasConflict
      },
      appliedOn: new Date().toISOString().split('T')[0]
    };

    this.store.addPermission(newRequest);
    this.closeModal('modalPermission');
    this.renderAllViews();
    this.showToast('Permission request submitted for review', 'success');
  }

  // REVIEW PERMISSION MODAL
  openPermissionReviewModal(permId) {
    this.activeReviewPermissionId = permId;
    const perm = this.store.getPermissions().find(p => p.id === permId);
    if (!perm) return;

    const detailsBox = document.getElementById('permReviewDetails');
    const reviewerInput = document.getElementById('permReviewerName');
    const noteInput = document.getElementById('permReviewNote');

    if (reviewerInput) reviewerInput.value = this.currentUser.name;
    if (noteInput) noteInput.value = perm.reviewNote || '';

    const flags = perm.flags || {};
    const conflictBanners = [];
    const resolutionBox = document.getElementById('permConflictResolutionBox');

    const hasConflict = !!(flags.onWeeklyOff || flags.onApprovedLeave);
    if (resolutionBox) {
      resolutionBox.style.display = hasConflict ? 'block' : 'none';
    }

    if (flags.onWeeklyOff) {
      conflictBanners.push('<div class="conflict-alert danger">⚠️ <strong>Conflict Flag:</strong> This request falls on the employee\'s configured weekly off day. Please select a conflict resolution below.</div>');
    }
    if (flags.onApprovedLeave) {
      conflictBanners.push('<div class="conflict-alert danger">⚠️ <strong>Conflict Flag:</strong> Employee has an approved leave on this date. Reviewer resolution required to clarify leave vs permission.</div>');
    }
    if (flags.overlapsShift) {
      conflictBanners.push(`<div class="conflict-alert info">⚡ <strong>Shift Overlap:</strong> Overlaps scheduled shift by ${minutesToHoursStr(flags.overlapMinutes || 0)}.</div>`);
    }

    detailsBox.innerHTML = `
      <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-size: 1.05rem; font-weight: 700;">${perm.employeeName} (${perm.employeeId})</h4>
          <span class="status-pill status-${perm.status.toLowerCase()}">${perm.status}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          <strong>Date:</strong> ${formatDate(perm.date)} &nbsp;•&nbsp; 
          <strong>Time:</strong> ${formatTime12(perm.startTime)} - ${formatTime12(perm.endTime)} (${perm.hours} hrs)
        </p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem; background: var(--bg-surface); padding: 0.65rem; border-radius: var(--radius-sm);">
          <strong>Reason:</strong> ${perm.reason}
        </p>
      </div>
      ${conflictBanners.join('')}
    `;

    this.openModal('modalPermissionReview');
  }

  handleReviewPermission(newStatus) {
    if (!this.activeReviewPermissionId) return;

    const perm = this.store.getPermissions().find(p => p.id === this.activeReviewPermissionId);
    const reviewer = document.getElementById('permReviewerName').value.trim() || this.currentUser.name;
    let note = document.getElementById('permReviewNote').value.trim();

    // Check if conflict resolution applies
    const flags = perm?.flags || {};
    if (newStatus === 'Approved' && (flags.onWeeklyOff || flags.onApprovedLeave)) {
      const selectedRes = document.querySelector('input[name="permConflictResolution"]:checked')?.value;
      if (selectedRes) {
        note = note ? `${note} [Conflict Resolution: ${selectedRes}]` : `[Conflict Resolution: ${selectedRes}]`;
      }
    }

    this.store.updatePermission(this.activeReviewPermissionId, {
      status: newStatus,
      reviewer,
      reviewNote: note
    });

    this.closeModal('modalPermissionReview');
    this.renderAllViews();
    this.showToast(`Permission request marked as ${newStatus}`, newStatus === 'Approved' ? 'success' : 'error');
  }

  cancelPermission(permId) {
    if (confirm('Cancel and delete this pending permission request?')) {
      const allPerms = this.store.getPermissions().filter(p => p.id !== permId);
      this.store.savePermissions(allPerms);
      this.renderAllViews();
      this.showToast('Permission request cancelled', 'info');
    }
  }

  // MODAL: APPLY FOR MONTHLY LEAVE
  openLeaveModal(prefillEmpId = null) {
    const select = document.getElementById('leaveFormEmployee');
    const employees = this.store.getEmployees();

    select.innerHTML = employees.map(e => `
      <option value="${e.id}" ${e.id === prefillEmpId ? 'selected' : ''}>
        ${e.name} (${e.sector})
      </option>
    `).join('');

    document.getElementById('leaveFormStartDate').value = '2026-10-16';
    document.getElementById('leaveFormEndDate').value = '2026-10-20';
    document.getElementById('leaveFormReason').value = '';

    this.runLiveLeaveImpactCheck();
    this.openModal('modalLeave');
  }

  runLiveLeaveImpactCheck() {
    const calcBox = document.getElementById('leaveLiveCalcBox');
    if (!calcBox) return;

    const empId = document.getElementById('leaveFormEmployee').value;
    const startDate = document.getElementById('leaveFormStartDate').value;
    const endDate = document.getElementById('leaveFormEndDate').value;

    const emp = this.store.getEmployeeById(empId);
    if (!emp || !startDate || !endDate) {
      calcBox.innerHTML = '';
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      calcBox.innerHTML = `
        <div class="conflict-alert danger">
          ❌ End date cannot be prior to start date.
        </div>
      `;
      return;
    }

    // Run leave calculation excluding weekly off days
    const leaveCalc = calculateLeaveDays(startDate, endDate, emp.weeklyOffDays);
    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();

    const balanceImpact = previewLeaveBalanceImpact(emp, leaveCalc.leaveDays, leaves, permissions, policy, '2026-10');

    // Build excluded days pills
    const excludedPills = leaveCalc.excludedDates.map(item => `
      <span class="excluded-tag">
        🏖️ ${item.shortDate} (${item.dayName} Off)
      </span>
    `).join('');

    const excludedExplanation = leaveCalc.excludedDates.length > 0
      ? `<div class="excluded-days-box">
          <h5>🏖️ Excluded Weekly Off Days (${leaveCalc.excludedDates.length} Days Not Counted):</h5>
          <div class="excluded-tags-row">${excludedPills}</div>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.4rem;">
            Per policy, ${getWeeklyOffDayNames(emp.weeklyOffDays).join(' and ')} are regular off days and are excluded from leave deduction.
          </p>
        </div>`
      : '<p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.5rem;">No configured weekly off days fall within this date range.</p>';

    let warningNotice = '';
    if (balanceImpact.willExceed) {
      warningNotice = `
        <div class="conflict-alert danger" style="margin-top: 0.75rem;">
          ⚠️ <strong>Balance Exceeded Warning:</strong> 
          Requesting ${leaveCalc.leaveDays} net days will exceed available allowance by ${balanceImpact.exceededBy} days (Projected balance: ${balanceImpact.projectedRemaining}d).
        </div>
      `;
    }

    calcBox.innerHTML = `
      <h4>📊 Real-time Leave Duration & Monthly Balance Preview</h4>
      <div class="calc-grid">
        <div class="calc-cell">
          <div class="calc-cell-label">Total Calendar Days</div>
          <div class="calc-cell-value">${leaveCalc.totalCalendarDays} days</div>
        </div>
        <div class="calc-cell">
          <div class="calc-cell-label">Excluded Off Days</div>
          <div class="calc-cell-value" style="color: #fda4af;">-${leaveCalc.excludedDates.length} days</div>
        </div>
        <div class="calc-cell">
          <div class="calc-cell-label">Net Leave Deducted</div>
          <div class="calc-cell-value highlight-green">${leaveCalc.leaveDays} days</div>
        </div>
        <div class="calc-cell">
          <div class="calc-cell-label">Current Balance</div>
          <div class="calc-cell-value">${balanceImpact.currentRemaining} days</div>
        </div>
        <div class="calc-cell">
          <div class="calc-cell-label">Projected Remaining</div>
          <div class="calc-cell-value ${balanceImpact.willExceed ? 'highlight-red' : 'highlight-green'}">
            ${balanceImpact.projectedRemaining} days
          </div>
        </div>
        <div class="calc-cell">
          <div class="calc-cell-label">Allowance Quota</div>
          <div class="calc-cell-value">${balanceImpact.currentAllowance} days</div>
        </div>
      </div>
      ${excludedExplanation}
      ${warningNotice}
    `;
  }

  handleSubmitLeave() {
    const empId = document.getElementById('leaveFormEmployee').value;
    const startDate = document.getElementById('leaveFormStartDate').value;
    const endDate = document.getElementById('leaveFormEndDate').value;
    const type = document.getElementById('leaveFormType').value;
    const reason = document.getElementById('leaveFormReason').value.trim();

    const emp = this.store.getEmployeeById(empId);
    if (!emp || !startDate || !endDate || !reason) {
      this.showToast('Please fill all required leave fields', 'error');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      this.showToast('End date cannot be prior to start date', 'error');
      return;
    }

    const leaveCalc = calculateLeaveDays(startDate, endDate, emp.weeklyOffDays);
    if (leaveCalc.leaveDays <= 0) {
      this.showToast('All selected dates are weekly off days! No leave deduction required.', 'warning');
      return;
    }

    const newLeave = {
      id: `LEV-${Math.floor(500 + Math.random() * 500)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      startDate,
      endDate,
      type,
      reason,
      requestedDays: leaveCalc.leaveDays,
      excludedDates: leaveCalc.excludedDates.map(d => d.dateStr),
      status: 'Pending',
      reviewer: null,
      reviewNote: '',
      appliedOn: new Date().toISOString().split('T')[0]
    };

    this.store.addLeave(newLeave);
    this.closeModal('modalLeave');
    this.renderAllViews();
    this.showToast(`Leave request for ${leaveCalc.leaveDays} net days submitted`, 'success');
  }

  // REVIEW LEAVE MODAL
  openLeaveReviewModal(leaveId) {
    this.activeReviewLeaveId = leaveId;
    const leave = this.store.getLeaves().find(l => l.id === leaveId);
    if (!leave) return;

    const emp = this.store.getEmployeeById(leave.employeeId);
    const leaves = this.store.getLeaves();
    const permissions = this.store.getPermissions();
    const policy = this.store.getPolicies();
    const balanceImpact = previewLeaveBalanceImpact(emp, leave.requestedDays, leaves, permissions, policy, '2026-10');

    const detailsBox = document.getElementById('leaveReviewDetails');
    const reviewerInput = document.getElementById('leaveReviewerName');
    const noteInput = document.getElementById('leaveReviewNote');

    if (reviewerInput) reviewerInput.value = this.currentUser.name;
    if (noteInput) noteInput.value = leave.reviewNote || '';

    const excludedDates = leave.excludedDates || [];
    const excludedTags = excludedDates.map(d => `<span class="excluded-tag">${formatDate(d)}</span>`).join('');

    detailsBox.innerHTML = `
      <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h4 style="font-size: 1.05rem; font-weight: 700;">${leave.employeeName} (${leave.employeeId})</h4>
          <span class="status-pill status-${leave.status.toLowerCase()}">${leave.status}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          <strong>Window:</strong> ${formatDate(leave.startDate)} to ${formatDate(leave.endDate)} &nbsp;•&nbsp; 
          <strong>Type:</strong> ${leave.type}
        </p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem; background: var(--bg-surface); padding: 0.65rem; border-radius: var(--radius-sm);">
          <strong>Reason:</strong> ${leave.reason}
        </p>
      </div>

      <div class="calc-impact-box">
        <h4>📊 Projected Monthly Leave Balance Upon Approval</h4>
        <div class="calc-grid">
          <div class="calc-cell">
            <div class="calc-cell-label">Net Days to Deduct</div>
            <div class="calc-cell-value highlight-green">${leave.requestedDays} days</div>
          </div>
          <div class="calc-cell">
            <div class="calc-cell-label">Current Balance</div>
            <div class="calc-cell-value">${balanceImpact.currentRemaining} days</div>
          </div>
          <div class="calc-cell">
            <div class="calc-cell-label">Projected Remaining</div>
            <div class="calc-cell-value ${balanceImpact.willExceed ? 'highlight-red' : 'highlight-green'}">
              ${balanceImpact.projectedRemaining} days
            </div>
          </div>
        </div>
      </div>

      ${excludedDates.length > 0 ? `
        <div class="excluded-days-box">
          <h5>🏖️ Weekly Off Days Excluded From Deduction (${excludedDates.length}):</h5>
          <div class="excluded-tags-row">${excludedTags}</div>
        </div>
      ` : ''}
    `;

    this.openModal('modalLeaveReview');
  }

  handleReviewLeave(newStatus) {
    if (!this.activeReviewLeaveId) return;

    const reviewer = document.getElementById('leaveReviewerName').value.trim() || this.currentUser.name;
    const note = document.getElementById('leaveReviewNote').value.trim();

    this.store.updateLeave(this.activeReviewLeaveId, {
      status: newStatus,
      reviewer,
      reviewNote: note
    });

    this.closeModal('modalLeaveReview');
    this.renderAllViews();
    this.showToast(`Leave request marked as ${newStatus}`, newStatus === 'Approved' ? 'success' : 'error');
  }

  cancelLeave(leaveId) {
    if (confirm('Cancel and delete this pending leave request?')) {
      const allLeaves = this.store.getLeaves().filter(l => l.id !== leaveId);
      this.store.saveLeaves(allLeaves);
      this.renderAllViews();
      this.showToast('Leave request cancelled', 'info');
    }
  }

  // Modal helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // Toast Notification helper
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `
      <span>${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Bootstrap Application onto window
window.addEventListener('DOMContentLoaded', () => {
  window.app = new WorkPulseApp();
});
