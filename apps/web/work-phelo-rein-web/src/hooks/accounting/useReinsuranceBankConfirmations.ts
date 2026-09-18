import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CASHBOOK_KEY } from '@/hooks/accounting/useCashAccounts';
import type {
  AccountingBankConfirmationWorkItem,
  ConfirmBankPaymentPayload,
} from '@/types/accountingIntegration';
import type { PlacementPayment } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const PENDING_BANK_CONFIRMATIONS_KEY = ['accounting', 'reinsurance-bank-confirmations'] as const;

export interface ConfirmReinsurerDisbursementBankPaymentPayload extends ConfirmBankPaymentPayload {
  placementId: string;
  paymentId: string;
}

function sourceDescription(payment: PlacementPayment) {
  if (payment.type === 'PREMIUM_RECEIVED') {
    return 'Cedant premium receipt';
  }
  if (payment.endorsementClosing) {
    return `Endorsement closing ${payment.endorsementClosing.closingNumber}`;
  }
  if (payment.closing) {
    return `Closing ${payment.closing.closingNumber}`;
  }
  return 'Credit-note allocation';
}

function sourceDetailUrl(payment: PlacementPayment) {
  return `/operations/reinsurance/facultative/${payment.placementId}`;
}

function firstAllocation(payment: PlacementPayment) {
  return payment.allocations?.[0] ?? null;
}

function sourceNicLevy(payment: PlacementPayment) {
  const values = payment.allocations
    ?.map((allocation) => allocation.note?.nicLevyAmount)
    .filter(Boolean)
    .map(Number);
  if (!values?.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) && total !== 0 ? total : null;
}

function sourceWithholdingTaxAmount(payment: PlacementPayment) {
  const values = payment.allocations
    ?.map((allocation) => allocation.note?.withholdingTaxAmount)
    .filter(Boolean)
    .map(Number);
  if (!values?.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) && total !== 0 ? total : null;
}

export function mapReinsurancePaymentToBankConfirmationWorkItem(
  payment: PlacementPayment,
): AccountingBankConfirmationWorkItem {
  const allocation = firstAllocation(payment);
  const obligationCurrency =
    allocation?.obligationCurrency ??
    payment.closing?.currency ??
    payment.endorsementClosing?.currency ??
    payment.placement?.currency ??
    payment.currency;
  const settlementMethod = payment.settlementMethod ?? null;
  const settlementCurrency = payment.settlementCurrency ?? null;

  return {
    id: `REINSURANCE:${payment.id}`,
    sourceModule: 'REINSURANCE',
    sourceRecordId: payment.id,
    sourceParentId: payment.placementId,
    sourceReference: payment.settlementReference ?? payment.reference ?? payment.id,
    transactionType: payment.type,
    direction: payment.direction,
    counterpartyId: payment.counterpartyId,
    sourceDescription: sourceDescription(payment),
    sourceDetailUrl: sourceDetailUrl(payment),
    counterpartyName: payment.counterparty.name,
    counterpartyType: payment.counterparty.type,
    amount: payment.amount,
    currency: payment.currency,
    operationalDate: payment.paymentDate,
    operationalReference: payment.reference,
    settlementReference: payment.settlementReference,
    operationalStatus: payment.status,
    confirmationStatus: payment.status === 'RECORDED' ? 'PENDING_CONFIRMATION' : payment.status,
    availableConfirmationActions: payment.status === 'RECORDED' ? ['CONFIRM_BANK_PAYMENT'] : [],
    businessSnapshot: {
      placementReference: payment.placement?.reference ?? payment.placementId,
      endorsementReference: payment.endorsementClosing?.endorsement?.endorsementNumber ?? null,
      closingReference:
        payment.endorsementClosing?.closingNumber ?? payment.closing?.closingNumber ?? null,
      counterpartyName: payment.counterparty.name,
      reinsurerName: payment.type === 'REINSURER_DISBURSEMENT' ? payment.counterparty.name : null,
      cedantName: payment.type === 'PREMIUM_RECEIVED' ? payment.counterparty.name : null,
      operationalPaymentAmount: payment.amount,
      operationalPaymentCurrency: payment.currency,
      settlementMethod,
      settlementCurrency,
      obligationCurrency,
      cedantPremiumPaymentCurrency: null,
      cedantPaymentFxRate: allocation?.agreedExchangeRate ?? payment.agreedExchangeRate,
      nicLevyAmount: sourceNicLevy(payment),
      contractualWithholdingTaxAmount: sourceWithholdingTaxAmount(payment),
      contractualWithholdingTaxRate: allocation?.note?.withholdingTaxPercent ?? null,
      creditNoteReference: allocation?.note?.noteNumber ?? null,
      operationalPaymentDate: payment.paymentDate,
      paymentReference: payment.reference,
    },
    metadata: {
      placementId: payment.placementId,
      closingId: payment.closingId,
      endorsementClosingId: payment.endorsementClosingId,
      participantId: payment.participantId,
    },
  };
}

export function usePendingReinsurerDisbursementConfirmations() {
  return useQuery({
    queryKey: PENDING_BANK_CONFIRMATIONS_KEY,
    queryFn: async () => {
      const res = await api.get<{ items: PlacementPayment[] }>(
        `${BASE}/payments/pending-bank-confirmation`,
      );
      return res.data.items;
    },
  });
}

export function useReinsuranceBankConfirmationWorkItems() {
  const paymentQuery = usePendingReinsurerDisbursementConfirmations();
  return {
    data: paymentQuery.data?.map(mapReinsurancePaymentToBankConfirmationWorkItem) ?? [],
    isLoading: paymentQuery.isLoading,
    isError: paymentQuery.isError,
    refetch: async () => {
      await paymentQuery.refetch();
    },
  };
}

function invalidateConfirmationAndCashbook(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: PENDING_BANK_CONFIRMATIONS_KEY });
  queryClient.invalidateQueries({ queryKey: CASHBOOK_KEY });
  queryClient.invalidateQueries({ queryKey: ['accounting', 'cash-accounts'] });
}

export function useConfirmReinsurerDisbursementBankPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      ...payload
    }: ConfirmReinsurerDisbursementBankPaymentPayload) => {
      const res = await api.post<PlacementPayment>(
        `${BASE}/${placementId}/payments/${paymentId}/bank-confirmation`,
        payload,
      );
      return res.data;
    },
    onSuccess: (payment) => {
      invalidateConfirmationAndCashbook(queryClient);
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'payments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'financial-position'],
      });
    },
  });
}
