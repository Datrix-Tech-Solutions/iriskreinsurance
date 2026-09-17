import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Counterparty,
  PaginatedCounterparties,
  CreateCounterpartyPayload,
  UpdateCounterpartyPayload,
} from '@/types/reinsurance';

const BROKERS_KEY = ['reinsurance', 'counterparties', 'BROKER'] as const;
const ENDPOINT = '/operations/reinsurance/counterparties';

export function useBrokers() {
  return useQuery({
    queryKey: BROKERS_KEY,
    queryFn: async () => {
      const res = await api.get<PaginatedCounterparties>(ENDPOINT, {
        params: { type: 'BROKER', limit: 100 },
      });
      return res.data.items ?? [];
    },
  });
}

export function useCreateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCounterpartyPayload) => {
      const res = await api.post<Counterparty>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BROKERS_KEY }),
  });
}

export function useUpdateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCounterpartyPayload & { id: string }) => {
      const res = await api.patch<Counterparty>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BROKERS_KEY }),
  });
}

/** Derived options for SearchSelect — reuses the cached useBrokers() data. */
export function useBrokerOptions() {
  const { data = [], isLoading } = useBrokers();
  return {
    options: data.map((b) => ({ value: b.id, label: b.name })),
    isLoading,
  };
}

export function useDeleteBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BROKERS_KEY }),
  });
}
