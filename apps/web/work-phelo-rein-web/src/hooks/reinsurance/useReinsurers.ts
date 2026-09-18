import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Counterparty,
  PaginatedCounterparties,
  CreateCounterpartyPayload,
  UpdateCounterpartyPayload,
} from '@/types/reinsurance';

const REINSURERS_KEY = ['reinsurance', 'counterparties', 'REINSURER'] as const;
const ENDPOINT = '/operations/reinsurance/counterparties';

export function useReinsurers() {
  return useQuery({
    queryKey: REINSURERS_KEY,
    queryFn: async () => {
      const res = await api.get<PaginatedCounterparties>(ENDPOINT, {
        params: { type: 'REINSURER', limit: 100 },
      });
      return res.data.items ?? [];
    },
  });
}

export function useCreateReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCounterpartyPayload) => {
      const res = await api.post<Counterparty>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURERS_KEY }),
  });
}

export function useUpdateReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCounterpartyPayload & { id: string }) => {
      const res = await api.patch<Counterparty>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURERS_KEY }),
  });
}

/** Derived options for SearchSelect — reuses the cached useReinsurers() data. */
export function useReinsurerOptions() {
  const { data = [], isLoading } = useReinsurers();
  return {
    options: data.map((r) => ({ value: r.id, label: r.name })),
    isLoading,
  };
}

export function useDeleteReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REINSURERS_KEY }),
  });
}
