import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ShiftSchedule,
  CreateShiftSchedulePayload,
  UpdateShiftSchedulePayload,
  MyScheduleOverview,
  ShiftSwapEligibleColleagueOption,
  CreateShiftSwapPayload,
  CreateSwapRequestPayload,
  ShiftSwapRequest,
  ShiftSwapStatus,
  RespondShiftSwapPayload,
  ReviewShiftSwapPayload,
} from '@/types/scheduling';
import { SwapRequest } from '@/components/molecules/hr/scheduling/SwapRequestCard';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

export function useShiftSchedules(employeeId?: string) {
  return useQuery({
    queryKey: ['schedules', employeeId ?? 'all'],
    queryFn: async () => {
      const res = await api.get<ShiftSchedule[]>('/hr/time/schedules', {
        params: employeeId ? { employeeId } : undefined,
      });
      return res.data ?? [];
    },
  });
}

export function useMyShiftSchedules() {
  return useQuery({
    queryKey: ['schedules', 'me'],
    queryFn: async () => {
      const res = await api.get<ShiftSchedule[]>('/hr/time/schedules');
      return res.data ?? [];
    },
  });
}

export function useMyScheduleOverview(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['schedules', 'me', 'overview', params?.from ?? null, params?.to ?? null],
    queryFn: async () => {
      const res = await api.get<MyScheduleOverview>('/hr/time/my-schedule', {
        params,
      });
      return res.data;
    },
  });
}

export function useCreateShiftSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateShiftSchedulePayload) => {
      const res = await api.post<ShiftSchedule>('/hr/time/schedules', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useUpdateShiftSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateShiftSchedulePayload }) => {
      const res = await api.patch<ShiftSchedule>(`/hr/time/schedules/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useDeleteShiftSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/time/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useEmployeeSchedules(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const res = await api.get<ShiftSchedule[]>('/hr/time/schedules', {
        params: { employeeId },
      });
      return res.data ?? [];
    },
  });
}

export function useEligibleShiftSwapColleagues(params?: {
  scheduleId?: string;
  shiftDate?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: [
      'shift-swaps',
      'eligible-colleagues',
      params?.scheduleId ?? null,
      params?.shiftDate ?? null,
      params?.search ?? null,
    ],
    enabled: Boolean(params?.scheduleId && params?.shiftDate),
    queryFn: async () => {
      const res = await api.get<ShiftSwapEligibleColleagueOption[]>(
        '/hr/time/shift-swaps/eligible-colleagues',
        {
          params: {
            scheduleId: params?.scheduleId,
            shiftDate: params?.shiftDate,
            search: params?.search,
          },
        },
      );
      return res.data ?? [];
    },
  });
}

export function useCreateShiftSwapRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateShiftSwapPayload) => {
      const res = await api.post<ShiftSwapRequest>('/hr/time/shift-swaps', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'me', 'overview'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useCreateSwapRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSwapRequestPayload) => {
      const res = await api.post('/hr/time/schedules/swap-requests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useMyShiftSwaps() {
  return useQuery({
    queryKey: ['shift-swaps', 'my'],
    queryFn: async () => {
      const res = await api.get<ShiftSwapRequest[]>('/hr/time/shift-swaps/my');
      return res.data ?? [];
    },
  });
}

export function useMySwapRequests() {
  return useQuery({
    queryKey: ['swap-requests', 'me'],
    queryFn: async () => {
      const res = await api.get<SwapRequest[]>('/hr/time/schedules/swap-requests');
      return res.data ?? [];
    },
  });
}

export function usePendingManagerShiftSwaps(status?: ShiftSwapStatus) {
  return useQuery({
    queryKey: ['shift-swaps', 'pending-manager', status ?? null],
    queryFn: async () => {
      try {
        const res = await api.get<ShiftSwapRequest[]>('/hr/time/shift-swaps/pending-manager', {
          params: status ? { status } : undefined,
        });
        return res.data ?? [];
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return [];
        throw err;
      }
    },
  });
}

export function useShiftSwap(shiftSwapId?: string) {
  return useQuery({
    queryKey: ['shift-swaps', shiftSwapId ?? null],
    enabled: Boolean(shiftSwapId),
    queryFn: async () => {
      const res = await api.get<ShiftSwapRequest>(`/hr/time/shift-swaps/${shiftSwapId}`);
      return res.data;
    },
  });
}

export function useRespondToShiftSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shiftSwapId,
      payload,
    }: {
      shiftSwapId: string;
      payload: RespondShiftSwapPayload;
    }) => {
      const res = await api.post<ShiftSwapRequest>(
        `/hr/time/shift-swaps/${shiftSwapId}/respond`,
        payload,
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', variables.shiftSwapId] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'me', 'overview'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useReviewShiftSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shiftSwapId,
      payload,
    }: {
      shiftSwapId: string;
      payload: ReviewShiftSwapPayload;
    }) => {
      const res = await api.post<ShiftSwapRequest>(
        `/hr/time/shift-swaps/${shiftSwapId}/manager-decision`,
        payload,
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', variables.shiftSwapId] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'me', 'overview'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}

export function useCancelShiftSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shiftSwapId: string) => {
      await api.delete(`/hr/time/shift-swaps/${shiftSwapId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'me', 'overview'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}
