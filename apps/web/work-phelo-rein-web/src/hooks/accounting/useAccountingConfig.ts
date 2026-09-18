import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AccountingTenantConfig, UpdateAccountingTenantConfigPayload } from '@/types/accounting';

const BASE = '/accounting/config';
const CONFIG_KEY = ['accounting', 'config'] as const;

export function useAccountingConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: async () => {
      const res = await api.get<AccountingTenantConfig>(BASE);
      return res.data;
    },
  });
}

export function useUpdateAccountingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateAccountingTenantConfigPayload) => {
      const res = await api.patch<AccountingTenantConfig>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
    },
  });
}
