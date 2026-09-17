import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Counterparty,
  PaginatedCounterparties,
  CreateCounterpartyPayload,
  UpdateCounterpartyPayload,
} from '@/types/reinsurance';

const CEDANTS_KEY = ['reinsurance', 'counterparties', 'CEDANT'] as const;
const ENDPOINT = '/operations/reinsurance/counterparties';

export function useCedants() {
  return useQuery({
    queryKey: CEDANTS_KEY,
    queryFn: async () => {
      const res = await api.get<PaginatedCounterparties>(ENDPOINT, {
        params: { type: 'CEDANT', limit: 100 },
      });
      return res.data.items ?? [];
    },
  });
}

export function useCreateCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCounterpartyPayload) => {
      const res = await api.post<Counterparty>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CEDANTS_KEY }),
  });
}

export function useUpdateCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCounterpartyPayload & { id: string }) => {
      const res = await api.patch<Counterparty>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CEDANTS_KEY }),
  });
}

/** Derived options for SearchSelect — reuses the cached useCedants() data. */
export function useCedantOptions() {
  const { data = [], isLoading } = useCedants();
  return {
    options: data.map((c) => ({ value: c.id, label: c.name })),
    isLoading,
  };
}

export function useDeleteCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CEDANTS_KEY }),
  });
}
