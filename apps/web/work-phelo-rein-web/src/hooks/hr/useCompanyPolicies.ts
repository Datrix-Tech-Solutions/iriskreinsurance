import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CompanyAgreement,
  CompanyAgreementSignaturesResponse,
  CompanyPoliciesSettings,
  CreateCompanyAgreementDto,
  MyCompanyAgreement,
  UpdateCompanyAgreementDto,
  UpdateCompanyPoliciesDto,
} from '@/types/hr';

export const companyPoliciesKeys = {
  all: ['company-policies'] as const,
  settings: () => ['company-policies', 'settings'] as const,
  agreements: () => ['company-policies', 'agreements'] as const,
  signatures: (id: string) => ['company-policies', 'agreements', id, 'signatures'] as const,
};

export function useCompanyPoliciesSettings() {
  return useQuery<CompanyPoliciesSettings>({
    queryKey: companyPoliciesKeys.settings(),
    queryFn: async () => {
      const res = await api.get<CompanyPoliciesSettings>('/hr/settings/company-policies');
      return res.data;
    },
  });
}

export function useUpdateCompanyPoliciesSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateCompanyPoliciesDto) => {
      const res = await api.patch<CompanyPoliciesSettings>(
        '/hr/settings/company-policies',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: companyPoliciesKeys.settings(),
      });
    },
  });
}

export function useCompanyAgreements(options?: { enabled?: boolean }) {
  return useQuery<CompanyAgreement[]>({
    queryKey: companyPoliciesKeys.agreements(),
    queryFn: async () => {
      const res = await api.get<CompanyAgreement[]>('/hr/company-agreements');
      return res.data;
    },
    enabled: options?.enabled,
  });
}

export function useCreateCompanyAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCompanyAgreementDto) => {
      const res = await api.post<CompanyAgreement>('/hr/company-agreements', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: companyPoliciesKeys.agreements(),
      });
    },
  });
}

export function useUpdateCompanyAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCompanyAgreementDto & { id: string }) => {
      const res = await api.patch<CompanyAgreement>(`/hr/company-agreements/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: companyPoliciesKeys.agreements(),
      });
    },
  });
}

export function useDeleteCompanyAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ message: string }>(`/hr/company-agreements/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: companyPoliciesKeys.agreements(),
      });
    },
  });
}

export function usePublishCompanyAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/hr/company-agreements/${id}/publish`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: companyPoliciesKeys.agreements(),
      });
    },
  });
}

export function useCompanyAgreementSignatures(id: string | null) {
  return useQuery<CompanyAgreementSignaturesResponse>({
    queryKey: companyPoliciesKeys.signatures(id ?? ''),
    queryFn: async () => {
      const res = await api.get<CompanyAgreementSignaturesResponse>(
        `/hr/company-agreements/${id}/signatures`,
      );
      return res.data;
    },
    enabled: !!id,
  });
}

export function useMyCompanyAgreements(options?: { enabled?: boolean }) {
  return useQuery<MyCompanyAgreement[]>({
    queryKey: ['my-company-agreements'],
    queryFn: async () => {
      const res = await api.get<MyCompanyAgreement[]>('/hr/company-agreements/me');
      return res.data;
    },
    enabled: options?.enabled,
  });
}

export function useSignMyAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, typedName }: { versionId: string; typedName: string }) => {
      const res = await api.post(`/hr/company-agreements/me/${versionId}/sign`, {
        typedName,
        consentAccepted: true,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company-agreements'] });
    },
  });
}

export function useDeclineMyAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, reason }: { versionId: string; reason: string }) => {
      const res = await api.post(`/hr/company-agreements/me/${versionId}/decline`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company-agreements'] });
    },
  });
}
