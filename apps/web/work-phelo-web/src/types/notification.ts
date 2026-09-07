export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  priority: NotificationPriority;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

export interface NotificationListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  meta: NotificationListMeta;
}

export interface UnreadCountResponse {
  count: number;
}

export type NotificationFilter = 'read' | 'unread';
