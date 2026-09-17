import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TenantBankAccount,
  TenantBankAccountPayload,
  TenantDocumentProfile,
  UpsertTenantDocumentProfilePayload,
} from '@/types/tenant-document-profile';

export const tenantDocumentProfileKeys = {
  profile: (tenantId: string) => ['tenant-document-profile', tenantId] as const,
  bankAccounts: (tenantId: string) =>
    ['tenant-document-profile', tenantId, 'bank-accounts'] as const,
};

export function useTenantDocumentProfile(tenantId?: string) {
  return useQuery({
    queryKey: tenantDocumentProfileKeys.profile(tenantId ?? ''),
    queryFn: () =>
      api
        .get<TenantDocumentProfile>(`/auth/tenants/${tenantId}/document-profile`)
        .then((response) => response.data),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useUpdateTenantDocumentProfile(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertTenantDocumentProfilePayload) =>
      api
        .put<TenantDocumentProfile>(`/auth/tenants/${tenantId}/document-profile`, payload)
        .then((response) => response.data),
    onSuccess: (profile) => {
      queryClient.setQueryData(tenantDocumentProfileKeys.profile(tenantId), profile);
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.profile(tenantId) });
    },
  });
}

export function useUploadTenantDocumentAsset(tenantId: string, assetType: 'logo' | 'signature') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api
        .post<TenantDocumentProfile>(
          `/auth/tenants/${tenantId}/document-profile/${assetType}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        .then((response) => response.data);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(tenantDocumentProfileKeys.profile(tenantId), profile);
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.profile(tenantId) });
    },
  });
}

export function useTenantDocumentBankAccounts(tenantId?: string) {
  return useQuery({
    queryKey: tenantDocumentProfileKeys.bankAccounts(tenantId ?? ''),
    queryFn: () =>
      api
        .get<TenantBankAccount[]>(`/auth/tenants/${tenantId}/document-profile/bank-accounts`)
        .then((response) => response.data),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}

export function useCreateTenantDocumentBankAccount(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TenantBankAccountPayload) =>
      api
        .post<TenantBankAccount>(
          `/auth/tenants/${tenantId}/document-profile/bank-accounts`,
          payload,
        )
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.profile(tenantId) });
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.bankAccounts(tenantId) });
    },
  });
}

export function useUpdateTenantDocumentBankAccount(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: string;
      payload: TenantBankAccountPayload;
    }) =>
      api
        .patch<TenantBankAccount>(
          `/auth/tenants/${tenantId}/document-profile/bank-accounts/${accountId}`,
          payload,
        )
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.profile(tenantId) });
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.bankAccounts(tenantId) });
    },
  });
}

export function useDeactivateTenantDocumentBankAccount(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      api
        .post<TenantBankAccount>(
          `/auth/tenants/${tenantId}/document-profile/bank-accounts/${accountId}/deactivate`,
        )
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.profile(tenantId) });
      queryClient.invalidateQueries({ queryKey: tenantDocumentProfileKeys.bankAccounts(tenantId) });
    },
  });
}
