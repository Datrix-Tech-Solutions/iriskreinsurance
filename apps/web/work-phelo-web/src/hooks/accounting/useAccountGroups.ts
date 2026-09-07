import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AccountGroup,
  CreateAccountGroupPayload,
  PaginatedResult,
  QueryAccountGroupsParams,
  UpdateAccountGroupPayload,
} from '@/types/accounting';

const BASE = '/accounting/account-groups';
const GROUPS_KEY = ['accounting', 'account-groups'] as const;

export function useAccountGroups(params: QueryAccountGroupsParams = {}) {
  return useQuery({
    queryKey: [...GROUPS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<AccountGroup>>(BASE, { params });
      return res.data;
    },
  });
}

export function useAccountGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: [...GROUPS_KEY, groupId],
    queryFn: async () => {
      const res = await api.get<AccountGroup>(`${BASE}/${groupId}`);
      return res.data;
    },
    enabled: !!groupId,
  });
}

export function useCreateAccountGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAccountGroupPayload) => {
      const res = await api.post<AccountGroup>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

export function useUpdateAccountGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountGroupPayload & { id: string }) => {
      const res = await api.patch<AccountGroup>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

/** Backend has no delete route — activate/deactivate are the dedicated endpoints. */
export function useActivateAccountGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountGroup>(`${BASE}/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}

export function useDeactivateAccountGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountGroup>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
    },
  });
}
