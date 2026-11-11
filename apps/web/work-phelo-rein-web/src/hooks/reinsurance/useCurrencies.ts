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

export async function fetchAllCurrencyMetadata(): Promise<Currency[]> {
  const rows: Currency[] = [];
  for (let page = 1; ; page += 1) {
    const res = await api.get<Currency[] | { items: Currency[]; meta?: { totalPages?: number } }>(
      BASE,
      { params: { page, limit: 100 } },
    );
    const list = extractList(res.data);
    rows.push(...list);
    if (Array.isArray(res.data) || page >= (res.data.meta?.totalPages ?? page)) break;
  }
  return rows;
}

export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => {
      return fetchAllCurrencyMetadata();
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
  const result = useCurrencies();
  return {
    ...result,
    data: result.data?.map((c) => ({
      value: c.isoCode,
      label: c.symbol ? `${c.symbol} ${c.isoCode} – ${c.name}` : `${c.isoCode} – ${c.name}`,
    })),
  };
}
