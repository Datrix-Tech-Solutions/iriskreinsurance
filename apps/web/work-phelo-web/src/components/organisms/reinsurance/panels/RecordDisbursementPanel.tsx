'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  useCreatePlacementPayment,
  useConfirmPlacementPaymentBank,
  usePlacementClosings,
  usePlacementPayments,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { premiumForeignSettlement } from '@/lib/reinsurance/premiumSettlement';
import { useToastStore } from '@/store/toast.store';
import {
  Facultative,
  PlacementFinancialPosition,
  PlacementReinsurerFinancialPosition,
  PlacementSettlementMethod,
} from '@/types/reinsurance';

const PAYMENT_METHOD_OPTIONS: { value: PlacementSettlementMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
];

function fmt(val: number, currency: string | null) {
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round a monetary value to 2 decimal places (cents). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type DisbursementSource = {
  closingId?: string;
  endorsementClosingId?: string;
  participantId?: string;
  outstanding: number;
  currency: string;
};

interface RecordDisbursementPanelProps {
  placement: Facultative;
  financialPosition?: PlacementFinancialPosition | null;
  target: PlacementReinsurerFinancialPosition | null;
  onClose: () => void;
}

export function RecordDisbursementPanel({
  placement,
  financialPosition,
  target,
  onClose,
}: RecordDisbursementPanelProps) {
  const createPayment = useCreatePlacementPayment();
  const confirmPaymentBank = useConfirmPlacementPaymentBank();
  const addToast = useToastStore((s) => s.addToast);
  const { data: closings = [] } = usePlacementClosings(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);

  const obligationCurrency = financialPosition?.currency ?? placement.currency ?? null;
  // Closings and the financial position are denominated in the obligation currency. If the
  // cedant premium was received in a single foreign currency, disburse to the reinsurer in
  // that same currency at that same rate: obligation = display × rate.
  const fx = useMemo(
    () => premiumForeignSettlement(payments, obligationCurrency),
    [payments, obligationCurrency],
  );
  const displayCurrency = fx ? fx.currency : obligationCurrency;
  const toDisplay = (obligationValue: number) => (fx ? obligationValue / fx.rate : obligationValue);
  const toObligation = (displayValue: number) => (fx ? displayValue * fx.rate : displayValue);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PlacementSettlementMethod>('BANK_TRANSFER');
  const [notes, setNotes] = useState('');
  const [referenceValue, setReferenceValue] = useState('');

  const referenceLabel =
    paymentMethod === 'BANK_TRANSFER'
      ? 'Bank Name'
      : paymentMethod === 'CHEQUE'
        ? 'Cheque Number'
        : null;

  const sources = useMemo<DisbursementSource[]>(() => {
    if (!target) return [];
    const originalSources = closings
      .filter(
        (closing) =>
          closing.status === 'CONFIRMED' &&
          closing.participant.counterpartyId === target.counterpartyId,
      )
      .map((closing) => {
        const paid = payments
          .filter(
            (payment) =>
              payment.type === 'REINSURER_DISBURSEMENT' &&
              (payment.status === 'RECORDED' || payment.status === 'BANK_CONFIRMED') &&
              !payment.reversalOfPaymentId &&
              payment.closingId === closing.id,
          )
          .reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
        const amount = parseMoney(closing.netPremium);
        return {
          closingId: closing.id,
          participantId: closing.participantId,
          outstanding: Math.max(0, amount - paid),
          currency: closing.currency ?? financialPosition?.currency ?? placement.currency ?? '',
        };
      });

    const endorsementSources =
      target.adjustments
        ?.filter((adjustment) => adjustment.amount > 0)
        .map((adjustment) => {
          const paid = payments
            .filter(
              (payment) =>
                payment.type === 'REINSURER_DISBURSEMENT' &&
                (payment.status === 'RECORDED' || payment.status === 'BANK_CONFIRMED') &&
                !payment.reversalOfPaymentId &&
                payment.endorsementClosingId === adjustment.closingId,
            )
            .reduce((sum, payment) => sum + parseMoney(payment.amount), 0);
          return {
            endorsementClosingId: adjustment.closingId,
            outstanding: Math.max(0, adjustment.amount - paid),
            currency: adjustment.currency,
          };
        }) ?? [];

    return [...originalSources, ...endorsementSources].filter(
      (source) => source.outstanding > 0.0001,
    );
  }, [closings, financialPosition?.currency, target, payments, placement.currency]);

  const totalOutstanding = useMemo(
    () => sources.reduce((sum, source) => sum + source.outstanding, 0),
    [sources],
  );

  const cedantObligation = financialPosition?.cedant.currentObligation ?? 0;
  const cedantCollected = financialPosition?.cedant.netSettled ?? 0;
  const cedantCollectionRatio =
    cedantObligation > 0.0001 ? Math.min(1, cedantCollected / cedantObligation) : null;
  const suggestedAmount =
    target && cedantCollectionRatio != null && totalOutstanding > 0
      ? Math.max(
          0,
          Math.min(
            totalOutstanding,
            cedantCollectionRatio * target.currentEffectivePayable - target.netSettled,
          ),
        )
      : null;

  useEffect(() => {
    if (!target) return;
    const prefill = toDisplay(suggestedAmount ?? totalOutstanding);
    setAmount(prefill > 0 ? round2(prefill) : 0);
    setPaymentMethod('BANK_TRANSFER');
    setNotes('');
    setReferenceValue('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, totalOutstanding, fx?.rate]);

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value as PlacementSettlementMethod);
    setReferenceValue('');
  };

  // Compare against the outstanding rounded to cents so a legitimate 2-decimal
  // entry (e.g. 12.18 for an outstanding of 12.1793843) isn't rejected as an overpayment.
  const maxAmount = round2(toDisplay(totalOutstanding));
  const amountError =
    totalOutstanding <= 0
      ? null
      : amount <= 0
        ? 'Enter an amount greater than zero.'
        : amount > maxAmount + 0.0001
          ? 'Amount cannot exceed the outstanding balance.'
          : null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!target) return;
    if (sources.length === 0) {
      addToast({
        message: 'No confirmed closing found to settle this outstanding amount against.',
        type: 'error',
      });
      return;
    }
    if (amountError || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      // The user enters the amount in the display (foreign) currency when `fx` is set; allocate
      // against the closings — which are obligation-currency — after converting back.
      let remaining = toObligation(amount);
      for (const source of sources) {
        if (remaining <= 0.0001) break;
        const portion = Math.min(source.outstanding, remaining);
        if (portion <= 0.0001) continue;

        const reference = referenceValue || undefined;

        const created = await createPayment.mutateAsync({
          placementId: placement.id,
          type: 'REINSURER_DISBURSEMENT',
          direction: 'OUTBOUND',
          counterpartyId: target.counterpartyId,
          closingId: source.closingId,
          endorsementClosingId: source.endorsementClosingId,
          participantId: source.participantId,
          amount: round2(portion),
          currency: source.currency,
          settlementMethod: paymentMethod,
          settlementCurrency: fx ? fx.currency : source.currency,
          paymentDate: now,
          reference,
          notes: notes || undefined,
        });

        remaining -= portion;

        try {
          await confirmPaymentBank.mutateAsync({
            placementId: placement.id,
            paymentId: created.id,
            bankConfirmedAt: now,
            ...(fx ? { settlementCurrency: fx.currency, agreedExchangeRate: fx.rate } : {}),
          });
        } catch (confirmError) {
          addToast({
            message: `Disbursement recorded, but bank confirmation failed automatically: ${extractError(confirmError)}. It will remain pending until confirmed.`,
            type: 'error',
          });
        }
      }
      addToast({ message: 'Reinsurer disbursement recorded successfully', type: 'success' });
      onClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!target) return null;

  const currency = displayCurrency;

  return (
    <Modal
      isOpen={!!target}
      onClose={handleClose}
      title="Confirm Reinsurer Disbursement"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !!amountError || amount <= 0}
          >
            {isSubmitting ? 'Recording…' : 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          Disburse to <span className="font-semibold text-gray-900">{target.counterpartyName}</span>
          , payable balance{' '}
          <span className="font-semibold text-gray-900">{fmt(amount, currency)}</span>, outstanding
          balance{' '}
          <span className="font-semibold text-gray-900">
            {fmt(toDisplay(target.outstanding), currency)}
          </span>
          .
        </p>
        {fx && (
          <p className="text-xs text-gray-500">
            Premium was received in {fx.currency}, amounts are shown and disbursed in {fx.currency}{' '}
            at 1 {fx.currency} = {fmt(fx.rate, obligationCurrency)}.
          </p>
        )}
        <SearchSelect
          label="Payment Method"
          placeholder="Select payment method…"
          options={PAYMENT_METHOD_OPTIONS}
          value={paymentMethod}
          onChange={handlePaymentMethodChange}
        />

        {referenceLabel && (
          <Input
            label={referenceLabel}
            value={referenceValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferenceValue(e.target.value)}
            placeholder={`Enter ${referenceLabel.toLowerCase()}…`}
            disabled={isSubmitting}
          />
        )}

        <NumberField
          label={currency ? `Amount (${currency})` : 'Amount'}
          value={amount}
          onChange={setAmount}
          onBlur={(v) => setAmount(round2(v))}
          error={amountError ?? undefined}
          disabled={isSubmitting}
          placeholder="0.00"
        />

        <Input
          label="Notes"
          type="textarea"
          rows={3}
          value={notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          placeholder="Add any notes about this disbursement…"
          disabled={isSubmitting}
        />
      </div>
    </Modal>
  );
}
