'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  AddPaymentFormFields,
  AddPaymentFormValues,
  ADD_PAYMENT_DEFAULTS,
} from '@/components/molecules/reinsurance/forms/AddPaymentFormFields';
import {
  useCreatePlacementPayment,
  useConfirmPlacementPaymentBank,
  useFacultativePlacement,
} from '@/hooks';
import { fetchPlacementFinancialPosition } from '@/hooks/reinsurance/usePayments';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { RiPerm } from '@/lib/reinsurance/permissions';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import { PaymentReceiptModal } from '@/components/organisms/reinsurance/documents/PaymentReceiptModal';

interface AddPaymentFormProps {
  placementId?: string;
  /** Pre-selects this cedant when the panel opens (e.g. the table's active cedant filter).
   *  Ignored when `placementId` is set, since that already locks a single cedant + business. */
  defaultCedantId?: string;
  onPaymentRecorded?: (amount: number) => void;
  onAllocationsRecorded?: (allocations: Record<string, number>) => void;
  onPlacementsChange?: (placementIds: string[]) => void;
  onPlacementsResolved?: (placements: Facultative[]) => void;
  defaultOpen?: boolean;
  /** Externally controlled open state — when provided, this component stops rendering its own
   *  "Receive Cedant Premium" trigger button and open/close is owned entirely by the caller
   *  (e.g. a table that already has its own action button for this and just wants the side
   *  panel to open in place instead of navigating to a separate page). */
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AddPaymentForm({
  placementId,
  defaultCedantId,
  onPaymentRecorded,
  onAllocationsRecorded,
  onPlacementsChange,
  onPlacementsResolved,
  defaultOpen = false,
  isOpen,
  onClose,
}: AddPaymentFormProps) {
  const isControlled = isOpen !== undefined;
  const canAddPayment = useAnyPermissionRules(RiPerm.addPayment);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const panelOpen = isControlled ? isOpen : internalOpen;
  const closePanel = () => {
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };
  const [receiptPrompt, setReceiptPrompt] = useState<{
    payment: PlacementPayment;
    placement: Facultative;
  } | null>(null);
  const [receiptData, setReceiptData] = useState<{
    payment: PlacementPayment;
    placement: Facultative;
  } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [resolvedPlacements, setResolvedPlacements] = useState<Facultative[]>([]);

  const { data: singlePlacement } = useFacultativePlacement(placementId ?? '');
  const createPayment = useCreatePlacementPayment();
  const confirmPaymentBank = useConfirmPlacementPaymentBank();
  const addToast = useToastStore((s) => s.addToast);

  const form = useForm<AddPaymentFormValues>({ defaultValues: ADD_PAYMENT_DEFAULTS });
  const {
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = form;

  // Pre-select the cedant every time the panel opens with one supplied (e.g. the table's
  // active cedant filter) — skipped when placementId is set, since that already locks a
  // single cedant + business via the read-only path in AddPaymentFormFields.
  useEffect(() => {
    if (panelOpen && !placementId && defaultCedantId) {
      setValue('cedantId', defaultCedantId);
      setValue('businessIds', []);
    }
  }, [panelOpen, placementId, defaultCedantId, setValue]);

  const onSubmit = async (values: AddPaymentFormValues) => {
    const selectedFacs = placementId
      ? singlePlacement
        ? [singlePlacement]
        : []
      : values.businessIds
          .map((id) => resolvedPlacements.find((placement) => placement.id === id))
          .filter((placement): placement is Facultative => Boolean(placement));
    if (selectedFacs.length === 0) return;

    const parsedAmount = parseFloat(values.amount) || 0;
    const hasAllocations = Object.keys(values.allocations).length > 0;

    const resolvedDate =
      values.paymentType === 'cheque'
        ? values.valueDate
        : values.paymentDate || new Date().toISOString();

    const refParts: string[] = [];
    if (values.chequeNumber) refParts.push(values.chequeNumber);
    if (values.bankName) refParts.push(values.bankName);
    const reference = refParts.join(' — ') || undefined;

    const notesStr = values.paymentType === 'cheque' ? 'Cheque payment' : 'Bank transfer';
    const notes = values.notes ? `${notesStr} — ${values.notes}` : notesStr;

    try {
      const positions = await Promise.all(
        selectedFacs.map((f) =>
          fetchPlacementFinancialPosition(f.id, new Date(resolvedDate).toISOString()),
        ),
      );
      const positionByPlacementId = new Map(
        selectedFacs.map((f, index) => [f.id, positions[index]]),
      );
      const totalOutstanding = selectedFacs.reduce((sum, f) => {
        const outstanding = positionByPlacementId.get(f.id)?.cedant.outstanding ?? 0;
        return sum + Math.max(0, outstanding);
      }, 0);
      const allSameCurrency =
        selectedFacs.length <= 1 ||
        selectedFacs.every(
          (f) =>
            (positionByPlacementId.get(f.id)?.currency ?? f.currency) ===
            (positionByPlacementId.get(selectedFacs[0].id)?.currency ?? selectedFacs[0].currency),
        );

      const calls = selectedFacs.map(async (f) => {
        let rawAmount: number;
        if (selectedFacs.length === 1) {
          rawAmount = parsedAmount;
        } else if (hasAllocations && values.allocations[f.id]) {
          rawAmount = parseFloat(values.allocations[f.id]) || 0;
        } else {
          const netPremium = Math.max(0, positionByPlacementId.get(f.id)?.cedant.outstanding ?? 0);
          const proportion =
            totalOutstanding > 0 ? netPremium / totalOutstanding : 1 / selectedFacs.length;
          rawAmount = proportion * parsedAmount;
        }

        const paymentCurrency = values.currency;
        const placementCurrency =
          positionByPlacementId.get(f.id)?.currency ?? f.currency ?? values.currency;
        const isCrossCurrency = paymentCurrency !== placementCurrency;

        // `rawAmount` is the money the cedant actually moved, in `paymentCurrency`. For a
        // cross-currency receipt we store the obligation-currency equivalent as `amount`
        // (rawAmount × rate) and keep the settlement currency + rate so the original figure
        // stays recoverable (settlement = amount ÷ rate).
        const rate = isCrossCurrency
          ? parseFloat(
              allSameCurrency ? values.rate : (values.allocationRates[f.id] ?? values.rate),
            ) || 1
          : 1;
        const submittedAmount =
          Math.round((isCrossCurrency ? rawAmount * rate : rawAmount) * 100) / 100;

        const created = await createPayment.mutateAsync({
          placementId: f.id,
          type: 'PREMIUM_RECEIVED',
          direction: 'INBOUND',
          counterpartyId: values.cedantId,
          amount: submittedAmount,
          currency: placementCurrency,
          paymentDate: new Date(resolvedDate).toISOString(),
          reference,
          settlementMethod: values.paymentType === 'cheque' ? 'CHEQUE' : 'BANK_TRANSFER',
          settlementCurrency: isCrossCurrency ? paymentCurrency : placementCurrency,
          notes,
        });

        // Confirm right after recording — everything the confirm endpoint needs
        // (settlement method/currency/reference) is already on the payment from the
        // create call above. The FX rate + settlement currency only round-trip through
        // bank-confirmation, so pass them here for cross-currency receipts.
        try {
          return await confirmPaymentBank.mutateAsync({
            placementId: f.id,
            paymentId: created.id,
            bankConfirmedAt: new Date(resolvedDate).toISOString(),
            ...(isCrossCurrency
              ? { settlementCurrency: paymentCurrency, agreedExchangeRate: rate }
              : {}),
          });
        } catch (confirmError) {
          addToast({
            message: `Payment recorded for ${f.policyNumber ?? f.title}, but bank confirmation failed automatically: ${extractError(confirmError)}. It will remain pending until confirmed.`,
            type: 'error',
          });
          return created;
        }
      });

      const results = await Promise.all(calls);

      onPaymentRecorded?.(parsedAmount);

      const allocEntries = Object.entries(values.allocations ?? {});
      if (allocEntries.length > 0) {
        const parsed: Record<string, number> = {};
        allocEntries.forEach(([id, val]) => {
          parsed[id] = parseFloat(val) || 0;
        });
        onAllocationsRecorded?.(parsed);
      }

      closePanel();
      form.reset(ADD_PAYMENT_DEFAULTS);
      setResolvedPlacements([]);
      onPlacementsResolved?.([]);

      // Offer receipt generation when placement context is available
      const firstPayment = results[0];
      const receiptPlacement = singlePlacement ?? selectedFacs[0];
      if (firstPayment && receiptPlacement) {
        setReceiptPrompt({ payment: firstPayment, placement: receiptPlacement });
      } else {
        addToast({ message: 'Payment recorded successfully', type: 'success' });
      }
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleGenerateReceipt = () => {
    if (receiptPrompt) setReceiptData(receiptPrompt);
    setReceiptPrompt(null);
    setReceiptOpen(true);
  };

  const handleLater = () => {
    addToast({ message: 'Payment recorded successfully', type: 'success' });
    setReceiptPrompt(null);
  };

  return (
    <>
      {!isControlled && canAddPayment && (
        <Button onClick={() => setInternalOpen(true)}>Receive Cedant Premium</Button>
      )}

      <SidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        title="Receive Cedant Premium"
        description="Record money received from the cedant for selected placement obligations."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button type="submit" form="add-payment-form" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Record Cedant Receipt'}
            </Button>
          </div>
        }
      >
        <form id="add-payment-form" onSubmit={handleSubmit(onSubmit)}>
          <AddPaymentFormFields
            form={form}
            placementId={placementId}
            onPlacementsChange={onPlacementsChange}
            onPlacementsResolved={(placements) => {
              setResolvedPlacements(placements);
              onPlacementsResolved?.(placements);
            }}
          />
        </form>
      </SidePanel>

      {/* Receipt prompt popup */}
      <Modal
        isOpen={!!receiptPrompt}
        onClose={handleLater}
        title="Generate Receipt"
        description="Payment recorded successfully. Would you like to generate a receipt?"
        footer={
          <>
            <Button variant="outline" onClick={handleLater}>
              Later
            </Button>
            <Button onClick={handleGenerateReceipt}>Generate</Button>
          </>
        }
      />

      {/* Receipt modal */}
      {receiptData && (
        <PaymentReceiptModal
          isOpen={receiptOpen}
          placement={receiptData.placement}
          payment={receiptData.payment}
          onClose={() => {
            setReceiptOpen(false);
            setReceiptData(null);
          }}
        />
      )}
    </>
  );
}
