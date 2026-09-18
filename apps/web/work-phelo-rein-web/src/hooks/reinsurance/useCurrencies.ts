import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Currency, CreateCurrencyPayload, UpdateCurrencyPayload } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/settings/currencies';
const CURRENCIES_KEY = ['reinsurance', 'currencies'] as const;

function extractList(data: unknown): Currency[] {
  if (Array.isArray(data)) return data as Currency[];
  const paginated = data as { items?: Currency[]; data?: Currency[] };
  return paginated?.items ?? paginated?.data ?? [];
}

export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => {
      const res = await api.get(BASE);
      return extractList(res.data);
    },
  });
}

export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCurrencyPayload) => {
      const res = await api.post<Currency>(BASE, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCurrencyPayload & { id: string }) => {
      const res = await api.patch<Currency>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  });
}

export function useCurrencyOptions() {
  return useQuery({
    queryKey: [...CURRENCIES_KEY, 'options'],
    queryFn: async () => {
      const res = await api.get(BASE);
      const list = extractList(res.data);
      return list.map((c) => ({
        value: c.isoCode,
        label: c.symbol ? `${c.symbol} ${c.isoCode} – ${c.name}` : `${c.isoCode} – ${c.name}`,
      }));
    },
  });
}
