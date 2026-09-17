import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccountCategoryDefinition } from '@/types/accounting';

export function useAccountCategories() {
  return useQuery({
    queryKey: ['accounting', 'account-categories'],
    queryFn: async () =>
      (await api.get<AccountCategoryDefinition[]>('/accounting/account-categories')).data,
  });
}
