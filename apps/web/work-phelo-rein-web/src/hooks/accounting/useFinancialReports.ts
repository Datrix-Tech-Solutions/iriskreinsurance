import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  BalanceSheetReport,
  GeneralLedgerReport,
  IncomeStatementReport,
  TrialBalanceReport,
} from '@/types/accounting';

type Params = Record<string, string | boolean | undefined>;

function useReportQuery<T>(name: string, params: Params, enabled = true) {
  return useQuery({
    queryKey: ['accounting', 'reports', name, params],
    queryFn: async () => (await api.get<T>(`/accounting/reports/${name}`, { params })).data,
    enabled,
  });
}

export function useGeneralLedgerReport(params: Params, enabled: boolean) {
  return useReportQuery<GeneralLedgerReport>('general-ledger', params, enabled);
}

export function useTrialBalanceReport(params: Params, enabled: boolean) {
  return useReportQuery<TrialBalanceReport>('trial-balance', params, enabled);
}

export function useIncomeStatementReport(params: Params, enabled: boolean) {
  return useReportQuery<IncomeStatementReport>('income-statement', params, enabled);
}

export function useBalanceSheetReport(params: Params, enabled: boolean) {
  return useReportQuery<BalanceSheetReport>('balance-sheet', params, enabled);
}
