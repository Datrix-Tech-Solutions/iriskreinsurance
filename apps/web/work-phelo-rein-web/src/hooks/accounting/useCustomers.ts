import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AccountingCustomer,
  CreateAccountingCustomerPayload,
  PaginatedResult,
  QueryAccountingPartiesParams,
  UpdateAccountingCustomerPayload,
} from '@/types/accounting';

const BASE = '/accounting/customers';
const CUSTOMERS_KEY = ['accounting', 'customers'] as const;

export function useCustomers(params: QueryAccountingPartiesParams = {}) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<AccountingCustomer>>(BASE, { params });
      return res.data;
    },
  });
}

export function useCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, customerId],
    queryFn: async () => {
      const res = await api.get<AccountingCustomer>(`${BASE}/${customerId}`);
      return res.data;
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAccountingCustomerPayload) => {
      const res = await api.post<AccountingCustomer>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountingCustomerPayload & { id: string }) => {
      const res = await api.patch<AccountingCustomer>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}

/** Backend has no delete route — deactivate/activate are the dedicated endpoints. */
export function useDeactivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountingCustomer>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}

export function useActivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountingCustomer>(`${BASE}/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
  });
}
