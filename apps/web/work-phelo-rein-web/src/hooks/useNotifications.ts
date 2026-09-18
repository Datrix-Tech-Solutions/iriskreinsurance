import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Notification,
  NotificationFilter,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  recent: () => ['notifications', 'recent'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  list: (filter?: NotificationFilter, page = 1) =>
    ['notifications', 'all', filter ?? 'all', page] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.recent(),
    queryFn: () => api.get<Notification[]>('/notification/in-app').then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () =>
      api.get<UnreadCountResponse>('/notification/in-app/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useAllNotifications(filter?: NotificationFilter, page = 1) {
  return useQuery({
    queryKey: notificationKeys.list(filter, page),
    queryFn: () =>
      api
        .get<NotificationListResponse>('/notification/in-app/all', { params: { filter, page } })
        .then((r) => r.data),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<Notification>(`/notification/in-app/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch<{ message: string }>('/notification/in-app/mark-all-read').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ message: string }>(`/notification/in-app/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
