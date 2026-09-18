import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LeaveType,
  LeaveRequest,
  LeaveBalance,
  CreateLeaveTypeDto,
  CreateLeaveRequestDto,
} from '@/types/hr';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const leaveKeys = {
  all: ['leave'] as const,
  types: (tenantSlug: string) => ['leave', 'types', tenantSlug] as const,
  requestsBase: () => ['leave', 'requests'] as const,
  requests: (status?: string) => ['leave', 'requests', status ?? 'all'] as const,
  myRequests: () => ['leave', 'requests', 'my'] as const,
  onLeaveToday: () => ['leave', 'requests', 'on-leave-today'] as const,
  balances: (employeeId?: string) => ['leave', 'balances', employeeId ?? 'me'] as const,
};

// ─── Raw backend shapes ──────────────────────────────────────────────────────

interface RawBalance {
  leaveTypeId: string;
  leaveType?: { name: string };
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

interface RawLeaveRequest {
  id: string;
  employeeId: string;
  employee?: { firstName: string; lastName: string; avatarUrl?: string };
  leaveTypeId: string;
  leaveType?: { name: string; isPaid: boolean };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  documentationUrl?: string;
  status: string;
  approvedBy?: string;
  rejectedBy?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionNote?: string;
  createdAt: string;
  updatedAt?: string;
  coverageEmployee?: { id: string; firstName: string; lastName: string };
}

interface RawCreateLeaveRequestResponse {
  request: RawLeaveRequest;
  message?: string;
  notificationSummary?: {
    managerNotified: boolean;
    approverCount?: number;
  };
}

// ─── Response transformers ────────────────────────────────────────────────────

function transformBalance(b: RawBalance): LeaveBalance {
  return {
    leaveTypeId: b.leaveTypeId,
    leaveTypeName: b.leaveType?.name ?? '',
    entitled: b.totalDays,
    used: b.usedDays,
    pending: b.pendingDays,
    remaining: b.remainingDays,
    carriedOver: 0,
  };
}

function transformRequest(r: RawLeaveRequest): LeaveRequest {
  const status = r.status.toUpperCase();
  return {
    id: r.id,
    tenantSlug: '',
    employeeId: r.employeeId,
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
    employeeAvatarUrl: r.employee?.avatarUrl,
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveType?.name ?? '',
    isPaid: r.leaveType?.isPaid ?? false,
    startDate: r.startDate,
    endDate: r.endDate,
    totalDays: r.totalDays,
    reason: r.reason,
    documentationUrl: r.documentationUrl,
    status: status as LeaveRequest['status'],
    reviewedBy: r.approvedBy ?? r.rejectedBy ?? undefined,
    reviewedAt: r.approvedAt ?? r.rejectedAt ?? undefined,
    reviewNote: r.rejectionNote ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    coverageEmployee: r.coverageEmployee,
  };
}

// ─── Leave Types ──────────────────────────────────────────────────────────────

export function useLeaveTypes(tenantSlug: string) {
  return useQuery({
    queryKey: leaveKeys.types(tenantSlug),
    queryFn: async () => {
      const res = await api.get<LeaveType[]>('/hr/leave/types');
      return res.data;
    },
  });
}

export function useCreateLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeaveTypeDto) => {
      const res = await api.post<LeaveType>('/hr/leave/types', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

export function useUpdateLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: CreateLeaveTypeDto & { id: string }) => {
      const res = await api.patch<LeaveType>(`/hr/leave/types/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

export function useDeleteLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/leave/types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export function useLeaveRequests(status?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leaveKeys.requests(status),
    queryFn: async () => {
      const res = await api.get<RawLeaveRequest[]>('/hr/leave/requests', {
        params: status ? { status } : undefined,
      });
      return res.data.map(transformRequest);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: leaveKeys.myRequests(),
    queryFn: async () => {
      const res = await api.get<RawLeaveRequest[]>('/hr/leave/requests/my');
      return res.data.map(transformRequest);
    },
  });
}

/**
 * Company-wide, read-only list of employees currently on approved leave.
 * Unlike `useLeaveRequests`, this is not scoped by role — every employee
 * can see who is on leave today (no request detail, just the fact).
 */
export function useEmployeesOnLeaveToday() {
  return useQuery({
    queryKey: leaveKeys.onLeaveToday(),
    queryFn: async () => {
      const res = await api.get<{ employeeIds: string[] }>('/hr/leave/requests/on-leave-today');
      return res.data.employeeIds;
    },
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeaveRequestDto) => {
      const res = await api.post<RawCreateLeaveRequestResponse>('/hr/leave/requests', payload);
      return {
        request: transformRequest(res.data.request),
        message: res.data.message,
        notificationSummary: res.data.notificationSummary,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requestsBase() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReviewLeaveRequest() {
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
      const res = await api.patch<RawLeaveRequest>(`/hr/leave/requests/${id}/review`, {
        action,
        note,
      });
      return transformRequest(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requestsBase() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/hr/leave/requests/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requestsBase() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
    },
  });
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export function useLeaveBalances(employeeId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId),
    queryFn: async () => {
      const url = employeeId ? `/hr/leave/balances/${employeeId}` : '/hr/leave/balances/me';
      const res = await api.get<RawBalance[]>(url);
      return res.data.map(transformBalance);
    },
    enabled: options?.enabled ?? true,
  });
}
