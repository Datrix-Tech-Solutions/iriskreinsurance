import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CASHBOOK_KEY, CASH_ACCOUNTS_KEY } from '@/hooks/accounting/useCashAccounts';
import type {
  CashbookTransaction,
  CreateCashbookAdjustmentPayload,
  CreateCashbookEntryPayload,
  CreateCashbookTransferPayload,
  PaginatedResult,
  QueryCashbookParams,
  ReverseCashbookTransactionPayload,
} from '@/types/accounting';

const BASE = '/accounting/cashbook';

export function useCashbookTransactions(params: QueryCashbookParams = {}) {
  return useQuery({
    queryKey: [...CASHBOOK_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<CashbookTransaction>>(BASE, { params });
      return res.data;
    },
  });
}

export interface CashAndBankStats {
  netCashPosition: Record<string, number>;
  inflowMtd: Record<string, number>;
  outflowMtd: Record<string, number>;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function add(totals: Record<string, number>, currency: string, amount: string) {
  totals[currency] = (totals[currency] ?? 0) + Number(amount);
}

/**
 * Cashbook is the authoritative cash posting path. The API intentionally has no
 * multi-currency aggregate endpoint, so this reads every posted transaction and
 * returns separate per-currency totals rather than applying an unapproved FX rate.
 */
export function useCashAndBankStats() {
  const start = new Date();
  start.setDate(1);
  const fromDate = localDate(start);
  const toDate = localDate(new Date());

  return useQuery({
    queryKey: [...CASHBOOK_KEY, 'stats', fromDate, toDate],
    queryFn: async (): Promise<CashAndBankStats> => {
      const first = await api.get<PaginatedResult<CashbookTransaction>>(BASE, {
        params: { status: 'POSTED', page: 1, limit: 100 },
      });
      const pages = await Promise.all(
        Array.from({ length: Math.max(0, first.data.totalPages - 1) }, (_, index) =>
          api.get<PaginatedResult<CashbookTransaction>>(BASE, {
            params: { status: 'POSTED', page: index + 2, limit: 100 },
          }),
        ),
      );
      const transactions = [first.data, ...pages.map((page) => page.data)].flatMap(
        (page) => page.items,
      );
      const stats: CashAndBankStats = {
        netCashPosition: {},
        inflowMtd: {},
        outflowMtd: {},
      };

      for (const transaction of transactions) {
        if (transaction.direction === 'TRANSFER') continue;
        const isInflow = transaction.direction === 'INFLOW';
        add(
          stats.netCashPosition,
          transaction.currency,
          `${isInflow ? '' : '-'}${transaction.amount}`,
        );
        const transactionDate = transaction.transactionDate.slice(0, 10);
        if (transactionDate < fromDate || transactionDate > toDate) continue;
        add(
          isInflow ? stats.inflowMtd : stats.outflowMtd,
          transaction.currency,
          transaction.amount,
        );
      }
      return stats;
    },
  });
}

export function useCashbookTransaction(transactionId: string | undefined) {
  return useQuery({
    queryKey: [...CASHBOOK_KEY, transactionId],
    queryFn: async () => {
      const res = await api.get<CashbookTransaction>(`${BASE}/${transactionId}`);
      return res.data;
    },
    enabled: !!transactionId,
  });
}

function useInvalidateCashbook() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: CASHBOOK_KEY });
    queryClient.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
  };
}

export function useCreateCashbookReceipt() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/receipts`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookPayment() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/payments`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookCharge() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/charges`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookAdjustment() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookAdjustmentPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/adjustments`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookTransfer() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookTransferPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/transfers`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function usePostCashbookTransaction() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/${transactionId}/post`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useReverseCashbookTransaction() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async ({
      transactionId,
      ...payload
    }: ReverseCashbookTransactionPayload & { transactionId: string }) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/${transactionId}/reverse`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
