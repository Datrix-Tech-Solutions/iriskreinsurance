import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useUpdateModules(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modules: Record<string, boolean>) =>
      api.patch(`/auth/tenants/${tenantId}/modules`, modules).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });
}

export function useUpdateFeatures(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { module: string; features: Record<string, boolean> }) =>
      api.patch(`/auth/tenants/${tenantId}/features`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });
}

export function useFeatureHistory(tenantId: string) {
  return useQuery({
    queryKey: ['feature-history', tenantId],
    queryFn: () => api.get(`/auth/tenants/${tenantId}/feature-history`).then((r) => r.data),
  });
}

export interface ReinsuranceAccountingTenantIntegration {
  reinsuranceEnabled: boolean;
  accountingEnabled: boolean;
  integrationEnabled: boolean;
  active: boolean;
}

export function useReinsuranceAccountingTenantIntegration(tenantId: string) {
  return useQuery({
    queryKey: ['tenant-integration', tenantId, 'reinsurance-accounting'],
    queryFn: () =>
      api
        .get<ReinsuranceAccountingTenantIntegration>(
          `/auth/tenants/${tenantId}/integrations/reinsurance-accounting`,
        )
        .then((r) => r.data),
    enabled: Boolean(tenantId),
  });
}

export function useUpdateReinsuranceAccountingTenantIntegration(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api
        .patch<ReinsuranceAccountingTenantIntegration>(
          `/auth/tenants/${tenantId}/integrations/reinsurance-accounting`,
          { enabled },
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['tenant-integration', tenantId, 'reinsurance-accounting'], data);
      qc.invalidateQueries({ queryKey: ['tenant', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({
        queryKey: ['accounting', 'reinsurance-integration-status'],
      });
    },
  });
}
