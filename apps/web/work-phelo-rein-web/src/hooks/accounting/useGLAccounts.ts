import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateGLAccountPayload,
  GLAccount,
  QueryGLAccountsParams,
  UpdateGLAccountPayload,
} from '@/types/accounting';

const BASE = '/accounting/accounts';
const GL_ACCOUNTS_KEY = ['accounting', 'gl-accounts'] as const;

export function useGLAccounts(params: QueryGLAccountsParams = {}) {
  const { category, status } = params;
  return useQuery({
    queryKey: [...GL_ACCOUNTS_KEY, category ?? null, status ?? null],
    queryFn: async () => {
      const res = await api.get<GLAccount[]>(BASE, { params: { category, status } });
      return res.data;
    },
  });
}

export function useCreateGLAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateGLAccountPayload) => {
      const res = await api.post<GLAccount>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
    },
  });
}

export function useUpdateGLAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateGLAccountPayload & { id: string }) => {
      const res = await api.patch<GLAccount>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
    },
  });
}

/** Backend has no delete route — deactivating a GL account is a dedicated endpoint, not a PATCH. */
export function useDeactivateGLAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<GLAccount>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
    },
  });
}

export function useGLAccountOptions(params: QueryGLAccountsParams = {}) {
  const { data = [], isLoading } = useGLAccounts(params);
  return {
    options: data
      .filter((a) => a.status === 'ACTIVE' && a.allowPosting)
      .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
    isLoading,
  };
}
