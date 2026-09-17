import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardSummary } from '@/types/hr';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>('/hr/dashboard/summary');
      return res.data;
    },
  });
}
