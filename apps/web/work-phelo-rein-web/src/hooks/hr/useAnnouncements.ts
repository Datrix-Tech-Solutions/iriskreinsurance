import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  PaginatedAnnouncementsResponse,
  QueryAnnouncementsParams,
} from '@/types/hr';

function normalizeAnnouncementParams(params?: QueryAnnouncementsParams): QueryAnnouncementsParams {
  return {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.audienceType ? { audienceType: params.audienceType } : {}),
    ...(typeof params?.sendEmail === 'boolean' ? { sendEmail: params.sendEmail } : {}),
    ...(typeof params?.includeExpired === 'boolean'
      ? { includeExpired: params.includeExpired }
      : {}),
    ...(params?.view ? { view: params.view } : {}),
  };
}

export function useAnnouncements(params?: QueryAnnouncementsParams) {
  const normalizedParams = normalizeAnnouncementParams(params);

  return useQuery({
    queryKey: ['announcements', normalizedParams],
    queryFn: () =>
      api
        .get<PaginatedAnnouncementsResponse>('/hr/announcements', {
          params: normalizedParams,
        })
        .then((r) => r.data),
  });
}

export function useVisibleAnnouncements(params?: Omit<QueryAnnouncementsParams, 'view'>) {
  return useAnnouncements({
    ...params,
    view: 'visible',
  });
}

export function useAnnouncementsPage(params?: QueryAnnouncementsParams) {
  const query = useAnnouncements(params);

  return {
    ...query,
    items: query.data?.items ?? [],
    meta: query.data?.meta ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAnnouncementPayload) =>
      api.post('/hr/announcements', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/announcements/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAnnouncementPayload }) =>
      api.patch(`/hr/announcements/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/hr/announcements/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements-unread-count'] });
      qc.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
  });
}

export function useMarkAllAnnouncementsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/hr/announcements/mark-all-read').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements-unread-count'] });
      qc.invalidateQueries({ queryKey: ['employee-dashboard'] });
    },
  });
}

export function useAnnouncementsUnreadCount() {
  return useQuery({
    queryKey: ['announcements-unread-count'],
    queryFn: () => api.get<{ count: number }>('/hr/announcements/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });
}
