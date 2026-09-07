'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import {
  ConfirmPlacementClaimFinancialBankPayload,
  PlacementSettlementMethod,
} from '@/types/reinsurance';

const SETTLEMENT_METHODS: PlacementSettlementMethod[] = [
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'MOBILE_MONEY',
  'INTERNAL_OFFSET',
  'JOURNAL',
  'OTHER',
];

function methodLabel(method: PlacementSettlementMethod) {
  return method.replaceAll('_', ' ');
}

function defaultDateTimeLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

interface FormState {
  bankConfirmedAt: string;
  bankReference: string;
  settlementMethod: PlacementSettlementMethod;
  settlementCurrency: string;
  confirmedExchangeRate: string;
  bankChargeAmount: string;
  notes: string;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

interface ClaimBankConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  amount: string;
  currency: string;
  counterpartyName?: string;
  /** Operational settlement method already captured when the row was recorded, if any. */
  sourceSettlementMethod?: PlacementSettlementMethod | null;
  sourceSettlementCurrency?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: ConfirmPlacementClaimFinancialBankPayload) => Promise<unknown>;
}

/**
 * Reinsurance-owned "financially confirm" step for a RECORDED cedant settlement or recovery
 * receipt. Scoped to the fields the claim bank-confirm endpoints accept.
 */
export function ClaimBankConfirmModal({
  isOpen,
  title,
  description = 'Capture the Reinsurance financial confirmation facts for this claim settlement.',
  amount,
  currency,
  counterpartyName,
  sourceSettlementMethod,
  sourceSettlementCurrency,
  isSubmitting,
  onClose,
  onConfirm,
}: ClaimBankConfirmModalProps) {
  const [form, setForm] = useState<FormState>({
    bankConfirmedAt: defaultDateTimeLocal(),
    bankReference: '',
    settlementMethod: sourceSettlementMethod ?? 'BANK_TRANSFER',
    settlementCurrency: sourceSettlementCurrency ?? currency,
    confirmedExchangeRate: '',
    bankChargeAmount: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        bankConfirmedAt: defaultDateTimeLocal(),
        bankReference: '',
        settlementMethod: sourceSettlementMethod ?? 'BANK_TRANSFER',
        settlementCurrency: sourceSettlementCurrency ?? currency,
        confirmedExchangeRate: '',
        bankChargeAmount: '',
        notes: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onConfirm({
      bankConfirmedAt: new Date(form.bankConfirmedAt).toISOString(),
      bankReference: form.bankReference.trim() || undefined,
      settlementMethod: sourceSettlementMethod ? undefined : form.settlementMethod,
      settlementCurrency: sourceSettlementCurrency
        ? undefined
        : form.settlementCurrency.trim().toUpperCase() || currency,
      confirmedExchangeRate: toOptionalNumber(form.confirmedExchangeRate),
      bankChargeAmount: toOptionalNumber(form.bankChargeAmount),
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={description}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="claim-bank-confirm-form"
            isLoading={isSubmitting}
            loadingText="Confirming..."
          >
            Confirm
          </Button>
        </>
      }
    >
      <form id="claim-bank-confirm-form" className="mt-4 flex flex-col gap-4" onSubmit={submit}>
        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          {counterpartyName && (
            <div className="font-semibold text-gray-900">{counterpartyName}</div>
          )}
          <div className="mt-1">
            {currency}{' '}
            {Number(amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Confirmation Date"
            type="datetime-local"
            value={form.bankConfirmedAt}
            onChange={(e) => setForm((f) => ({ ...f, bankConfirmedAt: e.target.value }))}
            required
          />
          {!sourceSettlementMethod && (
            <label className="flex flex-col gap-(--field-label-gap,0.125rem)">
              <span className="text-sm font-bold text-gray-900">Settlement Method</span>
              <select
                className="h-10 w-full rounded-input border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                value={form.settlementMethod}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    settlementMethod: e.target.value as PlacementSettlementMethod,
                  }))
                }
              >
                {SETTLEMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {methodLabel(method)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!sourceSettlementCurrency && (
            <Input
              label="Settlement Currency"
              value={form.settlementCurrency}
              onChange={(e) => setForm((f) => ({ ...f, settlementCurrency: e.target.value }))}
              maxLength={3}
            />
          )}
          <Input
            label="Bank / Confirmation Reference"
            value={form.bankReference}
            onChange={(e) => setForm((f) => ({ ...f, bankReference: e.target.value }))}
            maxLength={100}
          />
          <Input
            label="Confirmed FX Rate"
            type="number"
            step="0.000001"
            min="0"
            value={form.confirmedExchangeRate}
            onChange={(e) => setForm((f) => ({ ...f, confirmedExchangeRate: e.target.value }))}
          />
          <Input
            label="Bank Charges"
            type="number"
            step="0.01"
            min="0"
            value={form.bankChargeAmount}
            onChange={(e) => setForm((f) => ({ ...f, bankChargeAmount: e.target.value }))}
          />
        </div>

        <Input
          label="Confirmation Notes"
          type="textarea"
          rows={3}
          value={form.notes}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setForm((f) => ({ ...f, notes: e.target.value }))
          }
          maxLength={1000}
        />
      </form>
    </Modal>
  );
}
