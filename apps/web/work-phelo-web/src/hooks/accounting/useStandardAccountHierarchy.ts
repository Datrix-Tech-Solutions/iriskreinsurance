import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StandardAccountHierarchySeedResult {
  classificationsCreated: number;
  classificationsSkipped: number;
  groupsCreated: number;
  groupsSkipped: number;
}

export function useSeedStandardAccountHierarchy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (
        await api.post<StandardAccountHierarchySeedResult>(
          '/accounting/account-hierarchy/seed-standard',
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'account-classifications'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'account-groups'] });
    },
  });
}
