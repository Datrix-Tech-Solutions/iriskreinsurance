import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ConnectMailboxPayload,
  MailboxConnection,
  MailboxConnectionStatus,
  MailboxProvider,
  MailboxSyncResponse,
  PaginatedMailboxes,
} from '@/types/reinsurance';

const MAILBOXES_KEY = ['reinsurance', 'email-mailboxes'] as const;
const ENDPOINT = '/operations/reinsurance/email/mailboxes';

interface MailboxesQueryParams {
  provider?: MailboxProvider;
  status?: MailboxConnectionStatus;
}

export function useMailboxes(params?: MailboxesQueryParams) {
  return useQuery({
    queryKey: [...MAILBOXES_KEY, params],
    queryFn: async () => {
      const res = await api.get<PaginatedMailboxes>(ENDPOINT, { params });
      return res.data;
    },
  });
}

export function useConnectMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConnectMailboxPayload) => {
      const res = await api.post<MailboxConnection>(`${ENDPOINT}/connect`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAILBOXES_KEY }),
  });
}

export function useVerifyMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<MailboxConnection>(`${ENDPOINT}/${id}/verify`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAILBOXES_KEY }),
  });
}

export function useSyncMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, limit }: { id: string; limit?: number }) => {
      const res = await api.post<MailboxSyncResponse>(`${ENDPOINT}/${id}/sync`, { limit });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAILBOXES_KEY });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'email-threads'] });
    },
  });
}

export function useArchiveMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<MailboxConnection>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MAILBOXES_KEY }),
  });
}
