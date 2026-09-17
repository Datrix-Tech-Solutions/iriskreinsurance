import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CostCentre, CreateCostCentrePayload, UpdateCostCentrePayload } from '@/types/accounting';

const BASE = '/accounting/cost-centres';
export const COST_CENTRES_KEY = ['accounting', 'cost-centres'] as const;

export function useCostCentres() {
  return useQuery({
    queryKey: COST_CENTRES_KEY,
    queryFn: async () => (await api.get<CostCentre[]>(BASE)).data,
  });
}

export function useCreateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCostCentrePayload) =>
      (await api.post<CostCentre>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COST_CENTRES_KEY }),
  });
}

export function useUpdateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCostCentrePayload & { id: string }) =>
      (await api.patch<CostCentre>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COST_CENTRES_KEY }),
  });
}

export function useDeactivateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<CostCentre>(`${BASE}/${id}/deactivate`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COST_CENTRES_KEY }),
  });
}
