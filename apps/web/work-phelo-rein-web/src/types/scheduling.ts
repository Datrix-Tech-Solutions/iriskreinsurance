export type BackendShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FLEXIBLE';
export type WorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID';
export type ShiftSwapStatus =
  | 'PENDING_COLLEAGUE'
  | 'PENDING_MANAGER'
  | 'APPROVED'
  | 'DECLINED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
export type ShiftSwapRole = 'REQUESTER' | 'COLLEAGUE';
export type ShiftSwapResponseAction = 'ACCEPT' | 'DECLINE';
export type ShiftSwapManagerAction = 'APPROVE' | 'REJECT';

export interface ShiftSchedule {
  id: string;
  tenantId: string;
  employeeId: string;
  shiftType: BackendShiftType;
  workMode: WorkMode;
  startTime: string;
  endTime: string;
  dayOfWeek: number[];
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  employee: {
    firstName: string;
    lastName: string;
  };
}

export interface CreateShiftSchedulePayload {
  employeeId: string;
  shiftType: BackendShiftType;
  workMode: WorkMode;
  startTime: string;
  endTime: string;
  /** JS getDay() values: 0=Sun, 1=Mon … 6=Sat */
  dayOfWeek: number[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateShiftSchedulePayload {
  shiftType?: BackendShiftType;
  workMode?: WorkMode;
  startTime?: string;
  endTime?: string;
  effectiveTo?: string;
}

export interface MyScheduleLeaveBlock {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveType: string;
}

export interface MyScheduleHoliday {
  id: string;
  name: string;
  date: string;
}

export interface ShiftAssignmentOverride {
  id: string;
  scheduleId: string;
  shiftDate: string;
  shiftType: BackendShiftType;
  startTime: string;
  endTime: string;
  workMode: WorkMode;
}

export interface MyScheduleShiftSwapSummary {
  id: string;
  role: ShiftSwapRole;
  requesterScheduleId: string;
  requesterShiftDate: string;
  targetScheduleId: string;
  targetShiftDate: string;
  status: ShiftSwapStatus;
  expiresAt: string;
}

export interface MyScheduleOverview {
  employeeId: string;
  schedules: ShiftSchedule[];
  leaveBlocks: MyScheduleLeaveBlock[];
  publicHolidays: MyScheduleHoliday[];
  assignmentOverrides: ShiftAssignmentOverride[];
  shiftSwaps: MyScheduleShiftSwapSummary[];
}

export interface ShiftSwapEligibleColleagueOption {
  colleagueEmployeeId: string;
  colleagueName: string;
  scheduleId: string;
  shiftDate: string;
  shiftType: BackendShiftType;
  startTime: string;
  endTime: string;
  workMode: WorkMode;
}

export interface CreateShiftSwapPayload {
  requesterScheduleId: string;
  requesterShiftDate: string;
  targetScheduleId: string;
  targetShiftDate: string;
  reason?: string;
}

export interface CreateSwapRequestPayload {
  requesterScheduleId: string;
  requesterDate: string;
  targetEmployeeId: string;
  targetScheduleId: string;
  reason: string;
}

export interface ShiftSwapScheduleSnapshot {
  shiftType: BackendShiftType;
  startTime: string;
  endTime: string;
  workMode: WorkMode;
}

export interface ShiftSwapEmployeeSummary {
  id?: string;
  firstName: string;
  lastName: string;
  userId?: string | null;
}

export interface ShiftSwapRequest {
  id: string;
  tenantId: string;
  requesterEmployeeId: string;
  requesterScheduleId: string;
  requesterShiftDate: string;
  targetEmployeeId: string;
  targetScheduleId: string;
  targetShiftDate: string;
  managerEmployeeId: string | null;
  reason: string | null;
  status: ShiftSwapStatus;
  expiresAt: string;
  colleagueRespondedAt: string | null;
  managerDecisionAt: string | null;
  managerRejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  requesterEmployee?: ShiftSwapEmployeeSummary;
  targetEmployee?: ShiftSwapEmployeeSummary;
  managerEmployee?: ShiftSwapEmployeeSummary | null;
  requesterSchedule?: ShiftSwapScheduleSnapshot;
  targetSchedule?: ShiftSwapScheduleSnapshot;
}

export interface RespondShiftSwapPayload {
  action: ShiftSwapResponseAction;
}

export interface ReviewShiftSwapPayload {
  action: ShiftSwapManagerAction;
  reason?: string;
}
