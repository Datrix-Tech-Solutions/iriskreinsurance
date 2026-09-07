export type ClockStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ON_BREAK';
export type AttendanceWorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID';

export interface TodaySession {
  entryId?: string;
  status: ClockStatus;
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  totalMinutes: number;
  breakMinutes: number;
  isLate: boolean;
  isOutsideSchedule?: boolean;
  workMode?: AttendanceWorkMode | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  employeeName?: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  totalMinutes: number;
  status: ClockStatus | 'ABSENT';
  isLate: boolean;
  isOutsideSchedule?: boolean;
  workMode?: AttendanceWorkMode | null;
  location?: string;
  notes?: string;
}

export interface LiveAttendanceEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
  clockIn: string;
  breakStart?: string;
  status: ClockStatus;
  isLate: boolean;
  isOutsideSchedule?: boolean;
  workMode?: AttendanceWorkMode | null;
  location?: string;
}

export interface AttendanceStats {
  clockedIn: number;
  absent: number;
  late: number;
  flagged?: number;
  onBreak: number;
  total: number;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  reviewedAt?: string;
  reviewedByName?: string;
  createdAt: string;
}
