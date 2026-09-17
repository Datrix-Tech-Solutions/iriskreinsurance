import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AccountClassification,
  CreateAccountClassificationPayload,
  PaginatedResult,
  QueryAccountHierarchyParams,
  UpdateAccountClassificationPayload,
} from '@/types/accounting';

const BASE = '/accounting/account-classifications';
const CLASSIFICATIONS_KEY = ['accounting', 'account-classifications'] as const;

export function useAccountClassifications(params: QueryAccountHierarchyParams = {}) {
  return useQuery({
    queryKey: [...CLASSIFICATIONS_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<AccountClassification>>(BASE, { params });
      return res.data;
    },
  });
}

export function useAccountClassification(classificationId: string | undefined) {
  return useQuery({
    queryKey: [...CLASSIFICATIONS_KEY, classificationId],
    queryFn: async () => {
      const res = await api.get<AccountClassification>(`${BASE}/${classificationId}`);
      return res.data;
    },
    enabled: !!classificationId,
  });
}

export function useCreateAccountClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAccountClassificationPayload) => {
      const res = await api.post<AccountClassification>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSIFICATIONS_KEY });
    },
  });
}

export function useUpdateAccountClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateAccountClassificationPayload & { id: string }) => {
      const res = await api.patch<AccountClassification>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSIFICATIONS_KEY });
    },
  });
}

/** Backend has no delete route — activate/deactivate are the dedicated endpoints. */
export function useActivateAccountClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountClassification>(`${BASE}/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSIFICATIONS_KEY });
    },
  });
}

export function useDeactivateAccountClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<AccountClassification>(`${BASE}/${id}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASSIFICATIONS_KEY });
    },
  });
}
