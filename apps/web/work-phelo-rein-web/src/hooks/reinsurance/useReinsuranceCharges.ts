import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ReinsuranceChargeConfiguration,
  ReinsuranceChargePayload,
  ReinsuranceChargePreviewResult,
  ReinsuranceChargeTemplate,
  ReinsuranceChargeUpdatePayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/settings/charges';
export const REINSURANCE_CHARGES_KEY = ['reinsurance', 'settings', 'charges'] as const;

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const paginated = data as { items?: T[]; data?: T[] };
  return paginated?.items ?? paginated?.data ?? [];
}

export function useReinsuranceChargeTemplates() {
  return useQuery({
    queryKey: [...REINSURANCE_CHARGES_KEY, 'templates'],
    queryFn: async () => {
      const res = await api.get<ReinsuranceChargeTemplate[]>(`${BASE}/templates`);
      return res.data;
    },
  });
}

export function useReinsuranceCharges() {
  return useQuery({
    queryKey: REINSURANCE_CHARGES_KEY,
    queryFn: async () => {
      const res = await api.get(BASE);
      return extractList<ReinsuranceChargeConfiguration>(res.data);
    },
  });
}

export function useCreateReinsuranceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReinsuranceChargePayload) => {
      const res = await api.post<ReinsuranceChargeConfiguration>(BASE, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURANCE_CHARGES_KEY }),
  });
}

export function useUpdateReinsuranceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<ReinsuranceChargeUpdatePayload> & { id: string }) => {
      const res = await api.patch<ReinsuranceChargeConfiguration>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURANCE_CHARGES_KEY }),
  });
}

export function useDeactivateReinsuranceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ReinsuranceChargeConfiguration>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURANCE_CHARGES_KEY }),
  });
}

export function useActivateReinsuranceCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ReinsuranceChargeConfiguration>(`${BASE}/${id}/activate`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURANCE_CHARGES_KEY }),
  });
}

export function usePreviewReinsuranceCharges() {
  return useMutation({
    mutationFn: async (payload: {
      currency: string;
      grossAmount: number;
      commissionAmount?: number;
      brokerageAmount?: number;
      effectiveAt?: string;
    }) => {
      const res = await api.post<ReinsuranceChargePreviewResult>(`${BASE}/preview`, payload);
      return res.data;
    },
  });
}
