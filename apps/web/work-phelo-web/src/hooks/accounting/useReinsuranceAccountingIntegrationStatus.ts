import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ReinsuranceAccountingIntegrationStatus,
  ReinsuranceAccountingReadinessGroupKey,
} from '@/types/accountingIntegration';

const BASE = '/operations/reinsurance/accounting-integration/status';
const REINSURANCE_ACCOUNTING_INTEGRATION_STATUS_KEY = [
  'accounting',
  'reinsurance-integration-status',
] as const;

export function useReinsuranceAccountingIntegrationStatus() {
  return useQuery({
    queryKey: REINSURANCE_ACCOUNTING_INTEGRATION_STATUS_KEY,
    queryFn: async () => {
      const res = await api.get<ReinsuranceAccountingIntegrationStatus>(BASE);
      return res.data;
    },
  });
}

/**
 * Convenience read of one readiness group (premiumAccounting or cashConfirmation)
 * so callers can gate/warn on a specific workflow without repeating
 * the null-checks around `postingReadiness`/`readinessGroups` being unavailable
 * (Accounting not enabled, integration not configured, or the readiness check itself failed).
 */
export function useReinsuranceAccountingReadinessGroup(
  group: ReinsuranceAccountingReadinessGroupKey,
) {
  const { data, isLoading, isError } = useReinsuranceAccountingIntegrationStatus();
  const readinessGroup = data?.readinessGroups?.[group] ?? null;
  return {
    ready: readinessGroup?.ready ?? null,
    events: readinessGroup?.events ?? [],
    blockers: (readinessGroup?.events ?? []).flatMap((event) => event.blockers),
    isLoading,
    isError,
  };
}
