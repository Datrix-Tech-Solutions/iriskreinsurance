import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccountingTradeAllocation,
  AccountingTradeSettlement,
  AccountingTradeSide,
  CreateTradeAllocationPayload,
  CreateTradeSettlementPayload,
  PaginatedResult,
  QueryTradeSettlementsParams,
  ReverseTradeAllocationPayload,
  ReverseTradeDocumentPayload,
} from '@/types/accounting';

/* AR customer receipts and AP vendor payments — see useTradeDocuments.ts for the
 * same side-parameterized-single-implementation rationale. These are a distinct
 * entity from invoices/bills: cash-account-linked settlements that create/post
 * through Cashbook, and can be allocated (in whole or in part) to one or more
 * posted invoices/bills after posting. */

interface SettlementSideConfig {
  base: string;
  segment: 'receipts' | 'payments';
  partyKey: 'customer' | 'vendor';
  partyIdField: 'customerId' | 'vendorId';
  dateField: 'receiptDate' | 'paymentDate';
  documentIdField: 'invoiceId' | 'billId';
}

const SETTLEMENT_SIDE_CONFIG: Record<AccountingTradeSide, SettlementSideConfig> = {
  RECEIVABLE: {
    base: '/accounting/receivables',
    segment: 'receipts',
    partyKey: 'customer',
    partyIdField: 'customerId',
    dateField: 'receiptDate',
    documentIdField: 'invoiceId',
  },
  PAYABLE: {
    base: '/accounting/payables',
    segment: 'payments',
    partyKey: 'vendor',
    partyIdField: 'vendorId',
    dateField: 'paymentDate',
    documentIdField: 'billId',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSettlement = Record<string, any>;

function mapSettlement(raw: RawSettlement, side: AccountingTradeSide): AccountingTradeSettlement {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  return {
    id: raw.id,
    side,
    settlementNumber: raw.receiptNumber ?? raw.paymentNumber,
    settlementDate: raw[config.dateField],
    currency: raw.currency,
    amount: raw.amount,
    exchangeRate: raw.exchangeRate ?? null,
    reference: raw.reference ?? null,
    description: raw.description ?? null,
    externalReference: raw.externalReference ?? null,
    sourceModule: raw.sourceModule ?? null,
    sourceRecordId: raw.sourceRecordId ?? null,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    postedAt: raw.postedAt ?? null,
    reversedAt: raw.reversedAt ?? null,
    reversalOfSettlementId: raw.reversalOfReceiptId ?? raw.reversalOfPaymentId ?? null,
    party: raw[config.partyKey],
    cashbookTransaction: raw.cashbookTransaction,
  };
}

function mapAllocation(raw: RawSettlement): AccountingTradeAllocation {
  return {
    id: raw.id,
    amount: raw.amount,
    currency: raw.currency,
    allocatedAt: raw.allocatedAt,
    sourceType: raw.sourceType,
    reversedAt: raw.reversedAt ?? null,
    reversalReason: raw.reversalReason ?? null,
    document: raw.invoice ?? raw.bill,
  };
}

function settlementsKey(side: AccountingTradeSide) {
  return [
    'accounting',
    side === 'RECEIVABLE' ? 'receivable-receipts' : 'payable-payments',
  ] as const;
}

export function useReceivableReceipts(params: QueryTradeSettlementsParams = {}) {
  return useSettlements('RECEIVABLE', params);
}
export function usePayablePayments(params: QueryTradeSettlementsParams = {}) {
  return useSettlements('PAYABLE', params);
}

function useSettlements(side: AccountingTradeSide, params: QueryTradeSettlementsParams) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const { partyId, ...rest } = params;
  return useQuery({
    queryKey: [...settlementsKey(side), 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<RawSettlement>>(
        `${config.base}/${config.segment}`,
        { params: { ...rest, [config.partyIdField]: partyId } },
      );
      return { ...res.data, items: res.data.items.map((item) => mapSettlement(item, side)) };
    },
  });
}

export function useReceivableReceipt(receiptId: string | undefined) {
  return useSettlement('RECEIVABLE', receiptId);
}
export function usePayablePayment(paymentId: string | undefined) {
  return useSettlement('PAYABLE', paymentId);
}

function useSettlement(side: AccountingTradeSide, id: string | undefined) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  return useQuery({
    queryKey: [...settlementsKey(side), id],
    queryFn: async () => {
      const res = await api.get<RawSettlement>(`${config.base}/${config.segment}/${id}`);
      return mapSettlement(res.data, side);
    },
    enabled: !!id,
  });
}

function useInvalidateSettlement(side: AccountingTradeSide) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: settlementsKey(side) });
    // Posting/reversing a settlement posts/reverses a linked Cashbook transaction.
    queryClient.invalidateQueries({ queryKey: ['accounting', 'cashbook'] });
    queryClient.invalidateQueries({ queryKey: ['accounting', 'cash-accounts'] });
  };
}

export function useCreateReceivableReceipt() {
  return useCreateSettlement('RECEIVABLE');
}
export function useCreatePayablePayment() {
  return useCreateSettlement('PAYABLE');
}

function useCreateSettlement(side: AccountingTradeSide) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const invalidate = useInvalidateSettlement(side);
  return useMutation({
    mutationFn: async (payload: CreateTradeSettlementPayload) => {
      const { partyId, settlementDate, ...rest } = payload;
      const body = {
        ...rest,
        [config.partyIdField]: partyId,
        [config.dateField]: settlementDate,
      };
      const res = await api.post<RawSettlement>(`${config.base}/${config.segment}`, body);
      return mapSettlement(res.data, side);
    },
    onSuccess: invalidate,
  });
}

export function usePostReceivableReceipt() {
  return usePostSettlement('RECEIVABLE');
}
export function usePostPayablePayment() {
  return usePostSettlement('PAYABLE');
}

function usePostSettlement(side: AccountingTradeSide) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const invalidate = useInvalidateSettlement(side);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<RawSettlement>(`${config.base}/${config.segment}/${id}/post`);
      return mapSettlement(res.data, side);
    },
    onSuccess: invalidate,
  });
}

export function useReverseReceivableReceipt() {
  return useReverseSettlement('RECEIVABLE');
}
export function useReversePayablePayment() {
  return useReverseSettlement('PAYABLE');
}

function useReverseSettlement(side: AccountingTradeSide) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const invalidate = useInvalidateSettlement(side);
  return useMutation({
    mutationFn: async ({ id, ...payload }: ReverseTradeDocumentPayload & { id: string }) => {
      const res = await api.post<RawSettlement>(
        `${config.base}/${config.segment}/${id}/reverse`,
        payload,
      );
      return mapSettlement(res.data, side);
    },
    onSuccess: invalidate,
  });
}

export function useReceivableReceiptAllocations(receiptId: string | undefined) {
  return useSettlementAllocations('RECEIVABLE', receiptId);
}
export function usePayablePaymentAllocations(paymentId: string | undefined) {
  return useSettlementAllocations('PAYABLE', paymentId);
}

function useSettlementAllocations(side: AccountingTradeSide, settlementId: string | undefined) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  return useQuery({
    queryKey: [...settlementsKey(side), settlementId, 'allocations'],
    queryFn: async () => {
      const res = await api.get<RawSettlement[]>(
        `${config.base}/${config.segment}/${settlementId}/allocations`,
      );
      return res.data.map(mapAllocation);
    },
    enabled: !!settlementId,
  });
}

export function useAllocateReceivableReceipt() {
  return useAllocateSettlement('RECEIVABLE');
}
export function useAllocatePayablePayment() {
  return useAllocateSettlement('PAYABLE');
}

function useAllocateSettlement(side: AccountingTradeSide) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settlementId,
      documentId,
      amount,
    }: CreateTradeAllocationPayload & { settlementId: string }) => {
      const res = await api.post<RawSettlement>(
        `${config.base}/${config.segment}/${settlementId}/allocations`,
        { [config.documentIdField]: documentId, amount },
      );
      return mapAllocation(res.data);
    },
    onSuccess: (_result, { settlementId }) => {
      queryClient.invalidateQueries({ queryKey: [...settlementsKey(side), settlementId] });
      queryClient.invalidateQueries({
        queryKey: [...settlementsKey(side), settlementId, 'allocations'],
      });
      queryClient.invalidateQueries({
        queryKey: ['accounting', side === 'RECEIVABLE' ? 'receivable' : 'payable'],
      });
    },
  });
}

export function useReverseReceivableAllocation() {
  return useReverseAllocation('RECEIVABLE');
}
export function useReversePayableAllocation() {
  return useReverseAllocation('PAYABLE');
}

function useReverseAllocation(side: AccountingTradeSide) {
  const config = SETTLEMENT_SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      allocationId,
      ...payload
    }: ReverseTradeAllocationPayload & { allocationId: string }) => {
      const res = await api.post<RawSettlement>(
        `${config.base}/allocations/${allocationId}/reverse`,
        payload,
      );
      return mapAllocation(res.data);
    },
    onSuccess: () => {
      // Reversing an allocation changes both the settlement's own allocations list
      // and the invoice/bill outstanding balance it was applied against.
      queryClient.invalidateQueries({ queryKey: settlementsKey(side) });
      queryClient.invalidateQueries({
        queryKey: ['accounting', side === 'RECEIVABLE' ? 'receivable' : 'payable'],
      });
    },
  });
}
