import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateFiscalPeriodPayload,
  FiscalPeriod,
  QueryFiscalPeriodsParams,
} from '@/types/accounting';

const BASE = '/accounting/fiscal-periods';
const FISCAL_PERIODS_KEY = ['accounting', 'fiscal-periods'] as const;

export function useFiscalPeriods(params: QueryFiscalPeriodsParams = {}) {
  const { status } = params;
  return useQuery({
    queryKey: [...FISCAL_PERIODS_KEY, status ?? null],
    queryFn: async () => {
      const res = await api.get<FiscalPeriod[]>(BASE, { params: { status } });
      return res.data;
    },
  });
}

export function useCreateFiscalPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFiscalPeriodPayload) => {
      const res = await api.post<FiscalPeriod>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_PERIODS_KEY });
    },
  });
}

function useFiscalPeriodStatusMutation(action: 'open' | 'close' | 'lock') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<FiscalPeriod>(`${BASE}/${id}/${action}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_PERIODS_KEY });
    },
  });
}

export function useOpenFiscalPeriod() {
  return useFiscalPeriodStatusMutation('open');
}

export function useCloseFiscalPeriod() {
  return useFiscalPeriodStatusMutation('close');
}

export function useLockFiscalPeriod() {
  return useFiscalPeriodStatusMutation('lock');
}
