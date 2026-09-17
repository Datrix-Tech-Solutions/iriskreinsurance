import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tenant, RegisterTenantPayload, AuditData } from '@/types/tenant';

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get<{ tenants: Tenant[] }>('/auth/tenants');
      return res.data.tenants;
    },
  });
}

export function useRegisterTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterTenantPayload) => {
      const res = await api.post('/auth/tenants/register', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useApproveTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useSuspendTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/suspend`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useDeactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.delete(`/auth/tenants/${tenantId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useAssignAdmin() {
  return useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      email: string;
      firstName: string;
      lastName: string;
    }) => {
      const res = await api.post('/auth/users/assign-admin', {
        ...payload,
        role: 'TENANT_ADMIN',
      });
      return res.data;
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.post(`/auth/tenants/${tenantId}/admin/resend-invite`);
      return res.data;
    },
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get(`/auth/tenants/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTenantUsers(id: string) {
  return useQuery({
    queryKey: ['tenant-users', id],
    queryFn: () => api.get(`/auth/tenants/${id}/users`).then((r) => r.data),
    enabled: !!id,
  });
}

// Tenant-scoped: calls GET /auth/users — uses the JWT's own tenantId (no SUPER_ADMIN required)
export function useCurrentTenantUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['current-tenant-users'],
    queryFn: () => api.get('/auth/users').then((r) => r.data),
    enabled: options?.enabled !== false,
  });
}

export function useTenantAudit(id: string) {
  return useQuery({
    queryKey: ['tenant-audit', id],
    queryFn: () => api.get(`/auth/tenants/${id}/audit`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAuditLogs(page = 1) {
  return useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () =>
      api.get<AuditData>('/auth/audit', { params: { page, limit: 10 } }).then((r) => r.data),
  });
}

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name?: string;
      size?: string;
      industry?: string;
      country?: string;
      phone?: string;
    }) => api.patch(`/auth/tenants/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useUpdateTenantAdmin(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { firstName: string; lastName: string; email: string }) =>
      api.patch(`/auth/tenants/${id}/admin`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', id] });
    },
  });
}

export type TenantBrandingAssetType = 'app-logo' | 'sidebar-logo' | 'login-logo' | 'favicon';

export interface TenantBrandingAsset {
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  readUrl: string | null;
  readUrlExpiresAt: string | null;
}

export interface TenantBranding {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  appName: string;
  themeMode: 'LIGHT' | 'DARK' | 'SYSTEM';
  appLogo: TenantBrandingAsset;
  sidebarLogo: TenantBrandingAsset;
  loginLogo: TenantBrandingAsset;
  favicon: TenantBrandingAsset;
  logoDisplayUrl: string | null;
  faviconDisplayUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarColor: string;
  emailHeaderColor: string;
  documentHeaderColor: string;
  defaultsApplied: boolean;
}

export function useTenantBranding(tenantId: string) {
  return useQuery({
    queryKey: ['tenant-branding', tenantId],
    queryFn: () =>
      api.get<TenantBranding>(`/auth/tenants/${tenantId}/branding`).then((r) => r.data),
    enabled: !!tenantId,
  });
}

export interface PublicTenantBranding {
  tenantSlug: string;
  tenantName: string;
  appName: string;
  themeMode: 'LIGHT' | 'DARK' | 'SYSTEM';
  appLogoUrl: string | null;
  sidebarLogoUrl: string | null;
  loginLogoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarColor: string;
  emailHeaderColor: string;
  documentHeaderColor: string;
  defaultsApplied: boolean;
}

// Public, unauthenticated bootstrap endpoint — safe for any tenant user regardless of role.
export function usePublicTenantBranding(tenantSlug?: string) {
  return useQuery({
    queryKey: ['tenant-branding-public', tenantSlug],
    queryFn: () =>
      api
        .get<PublicTenantBranding>(`/auth/tenants/slug/${tenantSlug}/branding`)
        .then((r) => r.data),
    enabled: !!tenantSlug,
    staleTime: 60_000,
  });
}

export function useUpdateTenantBranding(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      primaryColor?: string | null;
      secondaryColor?: string | null;
      accentColor?: string | null;
      sidebarColor?: string | null;
      emailHeaderColor?: string | null;
      documentHeaderColor?: string | null;
    }) => api.patch(`/auth/tenants/${tenantId}/branding`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-branding', tenantId] });
    },
  });
}

export function useUploadTenantBrandingAsset(tenantId: string, assetType: TenantBrandingAssetType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api
        .post<TenantBranding>(`/auth/tenants/${tenantId}/branding/assets/${assetType}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    onSuccess: (branding) => {
      queryClient.setQueryData(['tenant-branding', tenantId], branding);
      queryClient.invalidateQueries({ queryKey: ['tenant-branding', tenantId] });
    },
  });
}
