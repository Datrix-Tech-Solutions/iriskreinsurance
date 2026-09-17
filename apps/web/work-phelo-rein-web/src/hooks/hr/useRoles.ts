import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PermissionSet,
  PermissionSetMember,
  Resource,
  UserEffectivePermissions,
  UserPermission,
  CreatePermissionSetDto,
  UpdatePermissionSetDto,
  GrantPermissionDto,
  RevokePermissionDto,
  AssignPermissionSetDto,
} from '@/types/roles';

// ── Permission Set Assignment ─────────────────────────────

export function useAssignPermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AssignPermissionSetDto) => {
      const res = await api.post('/auth/permissions/sets/assign', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'], exact: false });
    },
  });
}

export function useRemovePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, permissionSetId }: AssignPermissionSetDto) => {
      const res = await api.patch(`/auth/permissions/sets/remove/${userId}/${permissionSetId}`);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'], exact: false });
    },
  });
}

// ── Permission Resources ──────────────────────────────────

export function usePermissionResources() {
  return useQuery({
    queryKey: ['permissions', 'resources'],
    queryFn: async () => {
      const res = await api.get<Resource[]>('/auth/permissions/resources');
      return res.data;
    },
    staleTime: 10 * 60 * 1000, // resources rarely change
  });
}

// ── Permission Sets ───────────────────────────────────────

export function usePermissionSets(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['permissions', 'sets'],
    queryFn: async () => {
      const res = await api.get<PermissionSet[]>('/auth/permissions/sets');
      return res.data;
    },
    enabled: options?.enabled !== false,
  });
}

export function usePermissionSetMembers(permissionSetId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['permissions', 'sets', permissionSetId, 'members'],
    queryFn: async () => {
      const res = await api.get<PermissionSetMember[]>(
        `/auth/permissions/sets/${permissionSetId}/members`,
      );
      return res.data;
    },
    enabled: !!permissionSetId && options?.enabled !== false,
  });
}

export function useCreatePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePermissionSetDto) => {
      const res = await api.post<PermissionSet>('/auth/permissions/sets', dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
    },
  });
}

export function useUpdatePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdatePermissionSetDto & { id: string }) => {
      const res = await api.patch<PermissionSet>(`/auth/permissions/sets/${id}`, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
    },
  });
}

export function useDeletePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/permissions/sets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
    },
  });
}

// ── User Effective Permissions ────────────────────────────

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: ['permissions', 'users', userId],
    queryFn: async () => {
      const res = await api.get<UserEffectivePermissions>(`/auth/permissions/users/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useUserPermissionHistory(userId: string) {
  return useQuery({
    queryKey: ['permissions', 'users', userId, 'history'],
    queryFn: async () => {
      const res = await api.get<UserPermission[]>(`/auth/permissions/users/${userId}/history`);
      return res.data;
    },
    enabled: !!userId,
  });
}

// ── Direct Grant / Revoke ─────────────────────────────────

export function useGrantPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: GrantPermissionDto) => {
      const res = await api.post('/auth/permissions/grant', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId],
      });
    },
  });
}

export function useRevokePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: RevokePermissionDto) => {
      const res = await api.patch('/auth/permissions/revoke', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId, 'history'],
      });
    },
  });
}
