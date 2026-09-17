import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateSubledgerAccountPayload,
  QuerySubledgerAccountsParams,
  SubledgerAccount,
  UpdateSubledgerAccountPayload,
} from '@/types/accounting';

const BASE = '/accounting/subledger-accounts';
const SUBLEDGERS_KEY = ['accounting', 'subledgers'] as const;

export function useSubledgers(params: QuerySubledgerAccountsParams = {}) {
  return useQuery({
    queryKey: [...SUBLEDGERS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<SubledgerAccount[]>(BASE, { params });
      return res.data;
    },
  });
}

export function useCreateSubledger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSubledgerAccountPayload) => {
      const res = await api.post<SubledgerAccount>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBLEDGERS_KEY });
    },
  });
}

export function useUpdateSubledger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSubledgerAccountPayload & { id: string }) => {
      const res = await api.patch<SubledgerAccount>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBLEDGERS_KEY });
    },
  });
}

/** Backend has no activate route for subledger accounts (unlike vendors/customers) —
 *  deactivating a subledger here is currently one-way. */
export function useDeactivateSubledger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<SubledgerAccount>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBLEDGERS_KEY });
    },
  });
}
