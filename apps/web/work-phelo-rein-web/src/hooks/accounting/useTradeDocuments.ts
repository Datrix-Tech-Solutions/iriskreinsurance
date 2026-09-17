import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccountingTradeAllocation,
  AccountingTradeDocument,
  AccountingTradeDocumentBalance,
  AccountingTradeSide,
  CreateTradeAllocationPayload,
  CreateTradeCreditNotePayload,
  CreateTradeInvoicePayload,
  PaginatedResult,
  QueryTradeDocumentsParams,
  ReverseTradeDocumentPayload,
} from '@/types/accounting';

/* Accounts Receivable (customer invoices/credit notes) and Accounts Payable
 * (vendor bills/credit notes) are structurally identical backend records — same
 * fields, same lifecycle (draft → post → reverse), same balance formula —
 * differing only in the party relation name (customer vs vendor) and a couple of
 * relation key names (originalInvoice vs originalBill). Rather than duplicate
 * every hook/query twice, one internal implementation is parameterized by `side`
 * and a `documentSegment` ('invoices' | 'bills' | 'credit-notes'), and both
 * public APIs are thin wrappers over it, matching how callers already expect
 * useReceivableInvoice(s)/useReceivableCreditNote(s) and usePayableBill(s)/
 * usePayableCreditNote(s) naming (mirroring useVendors/useCustomers as separate,
 * familiar entry points). */

interface SideConfig {
  base: string;
  partyKey: 'customer' | 'vendor';
  partyIdField: 'customerId' | 'vendorId';
  originalKey: 'originalInvoice' | 'originalBill';
  originalIdField: 'originalInvoiceId' | 'originalBillId';
  appliedSettlementsField: 'appliedReceipts' | 'appliedPayments';
  invoiceSegment: 'invoices' | 'bills';
  /** Field name a credit-note allocation payload uses for the invoice/bill it applies to. */
  documentIdField: 'invoiceId' | 'billId';
}

const SIDE_CONFIG: Record<AccountingTradeSide, SideConfig> = {
  RECEIVABLE: {
    base: '/accounting/receivables',
    partyKey: 'customer',
    partyIdField: 'customerId',
    originalKey: 'originalInvoice',
    originalIdField: 'originalInvoiceId',
    appliedSettlementsField: 'appliedReceipts',
    invoiceSegment: 'invoices',
    documentIdField: 'invoiceId',
  },
  PAYABLE: {
    base: '/accounting/payables',
    partyKey: 'vendor',
    partyIdField: 'vendorId',
    originalKey: 'originalBill',
    originalIdField: 'originalBillId',
    appliedSettlementsField: 'appliedPayments',
    invoiceSegment: 'bills',
    documentIdField: 'billId',
  },
};

const CREDIT_NOTE_SEGMENT = 'credit-notes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTradeDocument = Record<string, any>;

function mapDocument(raw: RawTradeDocument, side: AccountingTradeSide): AccountingTradeDocument {
  const config = SIDE_CONFIG[side];
  const original = raw[config.originalKey] ?? null;
  return {
    id: raw.id,
    side,
    documentType: raw.documentType,
    documentNumber: raw.documentNumber,
    documentDate: raw.documentDate,
    dueDate: raw.dueDate ?? null,
    currency: raw.currency,
    exchangeRate: raw.exchangeRate ?? null,
    subtotalAmount: raw.subtotalAmount,
    taxAmount: raw.taxAmount,
    totalAmount: raw.totalAmount,
    description: raw.description ?? null,
    externalReference: raw.externalReference ?? null,
    sourceModule: raw.sourceModule ?? null,
    sourceRecordId: raw.sourceRecordId ?? null,
    offsetGlAccountId: raw.offsetGlAccountId,
    originalDocumentId: raw[config.originalIdField] ?? null,
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    postedAt: raw.postedAt ?? null,
    reversedAt: raw.reversedAt ?? null,
    postedJournalEntryId: raw.postedJournalEntryId ?? null,
    reversalJournalEntryId: raw.reversalJournalEntryId ?? null,
    reversalOfDocumentId: raw.reversalOfDocumentId ?? null,
    party: raw[config.partyKey],
    offsetGlAccount: raw.offsetGlAccount,
    postedJournalEntry: raw.postedJournalEntry ?? null,
    reversalJournalEntry: raw.reversalJournalEntry ?? null,
    originalDocument: original
      ? {
          id: original.id,
          documentNumber: original.documentNumber,
          totalAmount: original.totalAmount,
          status: original.status,
        }
      : null,
  };
}

function mapAllocation(raw: RawTradeDocument): AccountingTradeAllocation {
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

function mapBalance(
  raw: RawTradeDocument,
  side: AccountingTradeSide,
): AccountingTradeDocumentBalance {
  const config = SIDE_CONFIG[side];
  return {
    currency: raw.currency,
    originalAmount: raw.originalAmount,
    appliedSettlements: raw[config.appliedSettlementsField],
    appliedCreditNotes: raw.appliedCreditNotes,
    outstandingAmount: raw.outstandingAmount,
    paymentState: raw.paymentState,
  };
}

function documentsKey(side: AccountingTradeSide, segment: string) {
  return ['accounting', side === 'RECEIVABLE' ? 'receivable' : 'payable', segment] as const;
}

function useDocuments(
  side: AccountingTradeSide,
  segment: string,
  params: QueryTradeDocumentsParams = {},
) {
  const config = SIDE_CONFIG[side];
  const { partyId, ...rest } = params;
  return useQuery({
    queryKey: [...documentsKey(side, segment), 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<RawTradeDocument>>(`${config.base}/${segment}`, {
        params: { ...rest, [config.partyIdField]: partyId },
      });
      return { ...res.data, items: res.data.items.map((item) => mapDocument(item, side)) };
    },
  });
}

function useDocument(side: AccountingTradeSide, segment: string, id: string | undefined) {
  const config = SIDE_CONFIG[side];
  return useQuery({
    queryKey: [...documentsKey(side, segment), id],
    queryFn: async () => {
      const res = await api.get<RawTradeDocument>(`${config.base}/${segment}/${id}`);
      return mapDocument(res.data, side);
    },
    enabled: !!id,
  });
}

function useDocumentBalance(side: AccountingTradeSide, id: string | undefined) {
  const config = SIDE_CONFIG[side];
  return useQuery({
    queryKey: [...documentsKey(side, config.invoiceSegment), id, 'balance'],
    queryFn: async () => {
      const res = await api.get<RawTradeDocument>(
        `${config.base}/${config.invoiceSegment}/${id}/balance`,
      );
      return mapBalance(res.data, side);
    },
    enabled: !!id,
  });
}

function useCreateInvoice(side: AccountingTradeSide) {
  const config = SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTradeInvoicePayload) => {
      const { partyId, ...rest } = payload;
      const body = { ...rest, [config.partyIdField]: partyId };
      const res = await api.post<RawTradeDocument>(`${config.base}/${config.invoiceSegment}`, body);
      return mapDocument(res.data, side);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(side, config.invoiceSegment) });
    },
  });
}

function useCreateCreditNote(side: AccountingTradeSide) {
  const config = SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTradeCreditNotePayload) => {
      const { partyId, originalDocumentId, ...rest } = payload;
      const body = {
        ...rest,
        [config.partyIdField]: partyId,
        [config.originalIdField]: originalDocumentId,
      };
      const res = await api.post<RawTradeDocument>(`${config.base}/${CREDIT_NOTE_SEGMENT}`, body);
      return mapDocument(res.data, side);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(side, CREDIT_NOTE_SEGMENT) });
    },
  });
}

function useAllocateCreditNote(side: AccountingTradeSide) {
  const config = SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creditNoteId,
      documentId,
      amount,
    }: CreateTradeAllocationPayload & { creditNoteId: string }) => {
      const res = await api.post<RawTradeDocument>(
        `${config.base}/${CREDIT_NOTE_SEGMENT}/${creditNoteId}/allocations`,
        { [config.documentIdField]: documentId, amount },
      );
      return mapAllocation(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(side, CREDIT_NOTE_SEGMENT) });
      queryClient.invalidateQueries({ queryKey: documentsKey(side, config.invoiceSegment) });
    },
  });
}

function usePostDocument(side: AccountingTradeSide, segment: string) {
  const queryClient = useQueryClient();
  const config = SIDE_CONFIG[side];
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<RawTradeDocument>(`${config.base}/${segment}/${id}/post`);
      return mapDocument(res.data, side);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(side, segment) });
    },
  });
}

function useReverseDocument(side: AccountingTradeSide, segment: string) {
  const config = SIDE_CONFIG[side];
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ReverseTradeDocumentPayload & { id: string }) => {
      const res = await api.post<RawTradeDocument>(
        `${config.base}/${segment}/${id}/reverse`,
        payload,
      );
      return mapDocument(res.data, side);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(side, segment) });
    },
  });
}

// ---- Invoices (AR) / Bills (AP) ----

export function useReceivableInvoices(params: QueryTradeDocumentsParams = {}) {
  return useDocuments('RECEIVABLE', SIDE_CONFIG.RECEIVABLE.invoiceSegment, params);
}
export function useReceivableInvoice(invoiceId: string | undefined) {
  return useDocument('RECEIVABLE', SIDE_CONFIG.RECEIVABLE.invoiceSegment, invoiceId);
}
export function useReceivableInvoiceBalance(invoiceId: string | undefined) {
  return useDocumentBalance('RECEIVABLE', invoiceId);
}
export function useCreateReceivableInvoice() {
  return useCreateInvoice('RECEIVABLE');
}
export function usePostReceivableInvoice() {
  return usePostDocument('RECEIVABLE', SIDE_CONFIG.RECEIVABLE.invoiceSegment);
}
export function useReverseReceivableInvoice() {
  return useReverseDocument('RECEIVABLE', SIDE_CONFIG.RECEIVABLE.invoiceSegment);
}

export function usePayableBills(params: QueryTradeDocumentsParams = {}) {
  return useDocuments('PAYABLE', SIDE_CONFIG.PAYABLE.invoiceSegment, params);
}
export function usePayableBill(billId: string | undefined) {
  return useDocument('PAYABLE', SIDE_CONFIG.PAYABLE.invoiceSegment, billId);
}
export function usePayableBillBalance(billId: string | undefined) {
  return useDocumentBalance('PAYABLE', billId);
}
export function useCreatePayableBill() {
  return useCreateInvoice('PAYABLE');
}
export function usePostPayableBill() {
  return usePostDocument('PAYABLE', SIDE_CONFIG.PAYABLE.invoiceSegment);
}
export function useReversePayableBill() {
  return useReverseDocument('PAYABLE', SIDE_CONFIG.PAYABLE.invoiceSegment);
}

// ---- Credit Notes (AR customer credits / AP vendor credits) ----

export function useReceivableCreditNotes(params: QueryTradeDocumentsParams = {}) {
  return useDocuments('RECEIVABLE', CREDIT_NOTE_SEGMENT, params);
}
export function useReceivableCreditNote(creditNoteId: string | undefined) {
  return useDocument('RECEIVABLE', CREDIT_NOTE_SEGMENT, creditNoteId);
}
export function useCreateReceivableCreditNote() {
  return useCreateCreditNote('RECEIVABLE');
}
export function usePostReceivableCreditNote() {
  return usePostDocument('RECEIVABLE', CREDIT_NOTE_SEGMENT);
}
export function useReverseReceivableCreditNote() {
  return useReverseDocument('RECEIVABLE', CREDIT_NOTE_SEGMENT);
}
export function useAllocateReceivableCreditNote() {
  return useAllocateCreditNote('RECEIVABLE');
}

export function usePayableCreditNotes(params: QueryTradeDocumentsParams = {}) {
  return useDocuments('PAYABLE', CREDIT_NOTE_SEGMENT, params);
}
export function usePayableCreditNote(creditNoteId: string | undefined) {
  return useDocument('PAYABLE', CREDIT_NOTE_SEGMENT, creditNoteId);
}
export function useCreatePayableCreditNote() {
  return useCreateCreditNote('PAYABLE');
}
export function usePostPayableCreditNote() {
  return usePostDocument('PAYABLE', CREDIT_NOTE_SEGMENT);
}
export function useReversePayableCreditNote() {
  return useReverseDocument('PAYABLE', CREDIT_NOTE_SEGMENT);
}
export function useAllocatePayableCreditNote() {
  return useAllocateCreditNote('PAYABLE');
}
