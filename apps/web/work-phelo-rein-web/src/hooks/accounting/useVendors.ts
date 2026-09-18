import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AccountingVendor,
  CreateAccountingVendorPayload,
  PaginatedResult,
  QueryAccountingPartiesParams,
  UpdateAccountingVendorPayload,
} from '@/types/accounting';

const BASE = '/accounting/vendors';
const VENDORS_KEY = ['accounting', 'vendors'] as const;

export function useVendors(params: QueryAccountingPartiesParams = {}) {
  return useQuery({
    queryKey: [...VENDORS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<AccountingVendor>>(BASE, { params });
      return res.data;
    },
  });
}

export function useVendor(vendorId: string | undefined) {
  return useQuery({
    queryKey: [...VENDORS_KEY, vendorId],
    queryFn: async () => {
      const res = await api.get<AccountingVendor>(`${BASE}/${vendorId}`);
      return res.data;
    },
    enabled: !!vendorId,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAccountingVendorPayload) => {
      const res = await api.post<AccountingVendor>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountingVendorPayload & { id: string }) => {
      const res = await api.patch<AccountingVendor>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
    },
  });
}

/** Backend has no delete route — deactivate/activate are the dedicated endpoints. */
export function useDeactivateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountingVendor>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
    },
  });
}

export function useActivateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountingVendor>(`${BASE}/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDORS_KEY });
    },
  });
}
