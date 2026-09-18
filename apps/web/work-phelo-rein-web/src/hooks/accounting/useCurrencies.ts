import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AccountingCurrency,
  CreateAccountingCurrencyPayload,
  UpdateAccountingCurrencyPayload,
} from '@/types/accounting';

const BASE = '/accounting/currencies';
const CURRENCIES_KEY = ['accounting', 'currencies'] as const;

export function useAccountingCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => {
      const res = await api.get<AccountingCurrency[]>(BASE);
      return res.data;
    },
  });
}

export function useCreateAccountingCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAccountingCurrencyPayload) => {
      const res = await api.post<AccountingCurrency>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

export function useUpdateAccountingCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountingCurrencyPayload & { id: string }) => {
      const res = await api.patch<AccountingCurrency>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

/** Backend has no delete route — "deleting" a currency deactivates it instead. */
export function useDeactivateAccountingCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<AccountingCurrency>(`${BASE}/${id}`, { isActive: false });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

export function useAccountingCurrencyOptions() {
  const { data = [], isLoading } = useAccountingCurrencies();
  return {
    options: data
      .filter((c) => c.isActive)
      .map((c) => ({
        value: c.code,
        label: c.symbol ? `${c.symbol} ${c.code} – ${c.name}` : `${c.code} – ${c.name}`,
      })),
    isLoading,
  };
}
