import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Asset, CreateAssetPayload, UpdateAssetPayload } from '@/types/asset';

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const res = await api.get<Asset[]>('/hr/assets');
      return res.data;
    },
  });
}

export function useAvailableAssets() {
  return useQuery({
    queryKey: ['assets', 'available'],
    queryFn: async () => {
      const res = await api.get<Asset[]>('/hr/assets/available');
      return res.data;
    },
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ['assets', id],
    queryFn: async () => {
      const res = await api.get<Asset>(`/hr/assets/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAssetPayload) => {
      const res = await api.post<Asset>('/hr/assets', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: UpdateAssetPayload & {
      id: string;
    }) => {
      const res = await api.patch<Asset>(`/hr/assets/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAssignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assetId, employeeId }: { assetId: string; employeeId: string }) => {
      const res = await api.post<Asset>(`/hr/assets/${assetId}/assign`, {
        employeeId,
      });
      return res.data;
    },
    onSuccess: (_, { assetId }) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['assets', assetId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUnassignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await api.post<Asset>(`/hr/assets/${assetId}/unassign`);
      return res.data;
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['assets', assetId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useRetireAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await api.post<Asset>(`/hr/assets/${assetId}/retire`);
      return res.data;
    },
    onSuccess: (_, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['assets', assetId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await api.delete(`/hr/assets/${assetId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
