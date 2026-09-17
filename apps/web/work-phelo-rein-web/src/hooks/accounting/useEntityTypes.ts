import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CreateEntityTypePayload, EntityType } from '@/types/accounting';

// No backend endpoint exists for this yet — this hook is wired ahead of it so the UI just
// starts working once `/accounting/entity-types` ships.
const BASE = '/accounting/entity-types';
const ENTITY_TYPES_KEY = ['accounting', 'entity-types'] as const;

export function useEntityTypes() {
  return useQuery({
    queryKey: [...ENTITY_TYPES_KEY, 'list'],
    queryFn: async () => {
      const res = await api.get<EntityType[]>(BASE);
      return res.data;
    },
  });
}

export function useCreateEntityType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEntityTypePayload) => {
      const res = await api.post<EntityType>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENTITY_TYPES_KEY });
    },
  });
}

export function useDeleteEntityType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENTITY_TYPES_KEY });
    },
  });
}
