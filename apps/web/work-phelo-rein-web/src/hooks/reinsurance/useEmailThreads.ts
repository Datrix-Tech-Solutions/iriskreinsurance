import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PaginatedEmailThreads } from '@/types/reinsurance';

const EMAIL_THREADS_KEY = ['reinsurance', 'email-threads'] as const;
const ENDPOINT = '/operations/reinsurance/email/threads';

interface EmailThreadsQueryParams {
  mailboxConnectionId?: string;
  search?: string;
  limit?: number;
}

export function useEmailThreads(params: EmailThreadsQueryParams) {
  return useQuery({
    queryKey: [...EMAIL_THREADS_KEY, params],
    queryFn: async () => {
      const res = await api.get<PaginatedEmailThreads>(ENDPOINT, {
        params: { limit: 100, ...params },
      });
      return res.data;
    },
    enabled: Boolean(params.mailboxConnectionId),
  });
}
