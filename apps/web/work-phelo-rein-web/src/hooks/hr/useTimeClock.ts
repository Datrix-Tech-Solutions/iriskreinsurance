import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  TodaySession,
  TimeEntry,
  LiveAttendanceEntry,
  AttendanceStats,
  CorrectionRequest,
} from '@/types/timeclock';

// ── Transform raw backend ClockRecord → TimeEntry ────────────────────────────

interface RawAttendanceRecord {
  id: string;
  employeeId: string;
  clockIn: string | Date;
  clockOut?: string | Date | null;
  hoursWorked?: number | null;
  date: string | Date;
  isLate?: boolean;
  isOutsideSchedule?: boolean;
  workMode?: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
  location?: string | null;
  employee?: {
    firstName: string;
    lastName: string;
    jobTitle?: string;
    department?: { name: string };
  };
}

interface RawCorrectionRequest {
  id: string;
  employeeId: string;
  date: string | Date;
  requestedIn?: string | Date | null;
  requestedOut?: string | Date | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
  reviewedAt?: string | Date | null;
  createdAt: string | Date;
  employee?: {
    firstName: string;
    lastName: string;
  };
  reviewedBy?: {
    firstName: string;
    lastName: string;
  } | null;
}

function transformAttendanceRecord(r: RawAttendanceRecord): TimeEntry {
  const clockOut = r.clockOut ? new Date(r.clockOut) : null;
  const clockIn = new Date(r.clockIn);
  const hoursWorked = r.hoursWorked != null ? parseFloat(String(r.hoursWorked)) : 0;
  const totalMinutes = clockOut
    ? Math.round(hoursWorked * 60)
    : Math.floor((Date.now() - clockIn.getTime()) / 60000);
  const date =
    typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
    department: r.employee?.department?.name ?? undefined,
    jobTitle: r.employee?.jobTitle ?? undefined,
    date,
    clockIn: clockIn.toISOString(),
    clockOut: clockOut?.toISOString() ?? undefined,
    totalMinutes,
    breakMinutes: 0,
    status: clockOut ? 'CLOCKED_OUT' : 'CLOCKED_IN',
    isLate: Boolean(r.isLate),
    isOutsideSchedule: Boolean(r.isOutsideSchedule),
    workMode: r.workMode ?? null,
    location: r.location ?? undefined,
  };
}

function toIsoString(value?: string | Date | null) {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function transformCorrectionRequest(r: RawCorrectionRequest): CorrectionRequest {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : undefined,
    date: typeof r.date === 'string' ? r.date : r.date.toISOString(),
    requestedClockIn: toIsoString(r.requestedIn),
    requestedClockOut: toIsoString(r.requestedOut),
    reason: r.reason,
    status: r.status,
    reviewNote: r.reviewNote ?? undefined,
    reviewedAt: toIsoString(r.reviewedAt),
    reviewedByName: r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}` : undefined,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

// ── Employee ─────────────────────────────────────────────────────────────────

export function useMyTodaySession() {
  return useQuery<TodaySession>({
    queryKey: ['timeclock', 'today'],
    queryFn: () => api.get<TodaySession>('/hr/time/today').then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { location?: string; note?: string }) => {
      const res = await api.post<TodaySession>('/hr/time/clock-in', payload ?? {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/clock-out');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
  });
}

// Break start/end — not yet available in the backend
export function useStartBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/break/start');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
    },
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/break/end');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
    },
  });
}

export function useMyAttendanceHistory(page: number = 1) {
  return useQuery<{ data: TimeEntry[]; totalPages: number }>({
    queryKey: ['timeclock', 'history', page],
    queryFn: async () => {
      const res = await api.get('/hr/time/my-history');
      const raw = res.data;
      const records: RawAttendanceRecord[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return { data: records.map(transformAttendanceRecord), totalPages: 1 };
    },
  });
}
export function useAttendanceHistory(page: number = 1) {
  return useAttendanceRecords({ page });
}

export function useSubmitCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      date: string;
      requestedIn?: string;
      requestedOut?: string;
      reason: string;
    }) => {
      const res = await api.post<CorrectionRequest>('/hr/time/corrections', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
    },
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function useLiveAttendance() {
  return useQuery<LiveAttendanceEntry[]>({
    queryKey: ['timeclock', 'live'],
    queryFn: async () => {
      const res = await api.get('/hr/time/live');
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
    refetchInterval: 30_000,
  });
}

export function useAttendanceStats() {
  return useQuery<AttendanceStats>({
    queryKey: ['timeclock', 'stats'],
    queryFn: () => api.get<AttendanceStats>('/hr/time/stats/today').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useAttendanceRecords(params: {
  page: number;
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
  search?: string;
}) {
  return useQuery<{ data: TimeEntry[]; totalPages: number }>({
    queryKey: ['timeclock', 'records', params],
    queryFn: async () => {
      const res = await api.get('/hr/time/attendance', {
        params: {
          page: params.page,
          employeeId: params.employeeId || undefined,
          from: params.fromDate || undefined,
          to: params.toDate || undefined,
          departmentId: params.departmentId || undefined,
          status: params.status || undefined,
          search: params.search || undefined,
        },
      });
      const raw = res.data as
        | RawAttendanceRecord[]
        | { data: RawAttendanceRecord[]; totalPages: number };
      const records: RawAttendanceRecord[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const totalPages = Array.isArray(raw) ? 1 : (raw?.totalPages ?? 1);
      return { data: records.map(transformAttendanceRecord), totalPages };
    },
  });
}

export function useCorrectionRequests(status?: string) {
  return useQuery<CorrectionRequest[]>({
    queryKey: ['timeclock', 'corrections', status ?? 'all'],
    queryFn: async () => {
      const res = await api.get('/hr/time/corrections', {
        params: status ? { status } : undefined,
      });
      const raw = res.data as RawCorrectionRequest[] | { data: RawCorrectionRequest[] };
      const requests = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return requests.map(transformCorrectionRequest);
    },
  });
}

export function useReviewCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      note,
    }: {
      id: string;
      action: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => {
      const res = await api.patch<CorrectionRequest>(`/hr/time/corrections/${id}/review`, {
        action,
        note,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'records'] });
    },
  });
}
