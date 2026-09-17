'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useCashAccountOptions } from '@/hooks/accounting/useCashAccounts';
import type {
  AccountingBankConfirmationWorkItem,
  ConfirmBankPaymentPayload,
  SettlementMethod,
} from '@/types/accountingIntegration';

const PAGE_SIZE = 10;
const SETTLEMENT_METHODS: SettlementMethod[] = [
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'MOBILE_MONEY',
  'INTERNAL_OFFSET',
  'JOURNAL',
  'OTHER',
];

interface ConfirmationForm {
  bankConfirmedAt: string;
  bankReference: string;
  accountingCashAccountId: string;
  settlementMethod: SettlementMethod;
  settlementCurrency: string;
  confirmedExchangeRate: string;
  bankChargeAmount: string;
  notes: string;
}

const INITIAL_FORM: ConfirmationForm = {
  bankConfirmedAt: '',
  bankReference: '',
  accountingCashAccountId: '',
  settlementMethod: 'BANK_TRANSFER',
  settlementCurrency: '',
  confirmedExchangeRate: '',
  bankChargeAmount: '',
  notes: '',
};

interface FinancialConfirmationQueueProps {
  items: AccountingBankConfirmationWorkItem[];
  isLoading?: boolean;
  isError?: boolean;
  isConfirming?: boolean;
  onConfirm: (
    item: AccountingBankConfirmationWorkItem,
    payload: ConfirmBankPaymentPayload,
  ) => Promise<unknown>;
}

function fmtDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: number | string, currency: string) {
  const numeric = Number(amount);
  return `${currency} ${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

function defaultDateTimeLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function methodRequiresReference(method: SettlementMethod) {
  return method === 'BANK_TRANSFER' || method === 'CHEQUE' || method === 'MOBILE_MONEY';
}

function methodAffectsCash(method: SettlementMethod) {
  return (
    method === 'BANK_TRANSFER' ||
    method === 'CHEQUE' ||
    method === 'CASH' ||
    method === 'MOBILE_MONEY'
  );
}

function methodLabel(method: SettlementMethod) {
  return method.replaceAll('_', ' ');
}

const SETTLEMENT_METHOD_OPTIONS: SearchSelectOption[] = SETTLEMENT_METHODS.map((method) => ({
  value: method,
  label: methodLabel(method),
}));

function confirmationTitle(method: SettlementMethod, direction?: string) {
  const inbound = direction === 'INBOUND';
  switch (method) {
    case 'CHEQUE':
      return inbound ? 'Confirm cheque receipt' : 'Confirm Reinsurer cheque payment';
    case 'CASH':
      return inbound ? 'Confirm cash receipt' : 'Confirm Reinsurer cash payment';
    case 'MOBILE_MONEY':
      return inbound ? 'Confirm mobile-money receipt' : 'Confirm Reinsurer mobile-money payment';
    case 'INTERNAL_OFFSET':
      return 'Confirm internal offset';
    case 'JOURNAL':
      return 'Confirm journal settlement';
    case 'OTHER':
      return 'Confirm other settlement';
    case 'BANK_TRANSFER':
    default:
      return inbound ? 'Confirm Cedant bank receipt' : 'Confirm Reinsurer bank transfer';
  }
}

function confirmationActionLabel(item: AccountingBankConfirmationWorkItem) {
  if (item.action === 'CONFIRM_BANK_RECEIPT' || item.direction === 'INBOUND') {
    return 'Confirm Receipt';
  }
  return 'Confirm Payment';
}

function confirmationReferenceLabel(method: SettlementMethod) {
  switch (method) {
    case 'CHEQUE':
      return 'Clearance Reference';
    case 'CASH':
      return 'Cash Receipt Reference';
    case 'MOBILE_MONEY':
      return 'Provider Confirmation Reference';
    case 'INTERNAL_OFFSET':
      return 'Offset Approval Reference';
    case 'JOURNAL':
      return 'Journal Posting Reference';
    case 'OTHER':
      return 'Confirmation Evidence Reference';
    case 'BANK_TRANSFER':
    default:
      return 'Bank Transaction Reference';
  }
}

function fieldValue(value: string | number | null | undefined, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  PREMIUM_RECEIVED: 'PREMIUM RECEIVABLE',
  REINSURER_DISBURSEMENT: 'PREMIUM PAYABLE',
};

function transactionTypeLabel(transactionType: string) {
  return TRANSACTION_TYPE_LABELS[transactionType] ?? transactionType.replaceAll('_', ' ');
}

export function FinancialConfirmationQueue({
  items,
  isLoading,
  isError,
  isConfirming,
  onConfirm,
}: FinancialConfirmationQueueProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AccountingBankConfirmationWorkItem | null>(null);
  const [form, setForm] = useState<ConfirmationForm>(INITIAL_FORM);
  // SearchSelect is a custom widget, not a native <select>, so it doesn't get free
  // HTML5 "required" validation — track a submit attempt to surface field errors instead.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const sourceSettlementMethod = selectedItem?.businessSnapshot?.settlementMethod ?? null;
  const sourceSettlementCurrency = selectedItem?.businessSnapshot?.settlementCurrency ?? null;
  const selectedSettlementMethod = sourceSettlementMethod ?? form.settlementMethod;
  const selectedSettlementCurrency =
    sourceSettlementCurrency ?? form.settlementCurrency.trim().toUpperCase();
  const selectedRequiresCashAccount = methodAffectsCash(selectedSettlementMethod);
  const cashAccountOptions = useCashAccountOptions({
    currency: selectedSettlementCurrency || undefined,
    isActive: true,
  });
  const selectedHasOperationalReference = Boolean(selectedItem?.operationalReference);
  const selectedConfirmationTitle = confirmationTitle(
    selectedSettlementMethod,
    selectedItem?.direction,
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.sourceModule.toLowerCase().includes(q) ||
        item.transactionType.toLowerCase().includes(q) ||
        item.direction.toLowerCase().includes(q) ||
        item.counterpartyName.toLowerCase().includes(q) ||
        item.sourceReference.toLowerCase().includes(q) ||
        item.operationalReference?.toLowerCase().includes(q) ||
        item.settlementReference?.toLowerCase().includes(q) ||
        item.sourceDescription.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openConfirmModal = (item: AccountingBankConfirmationWorkItem) => {
    setSelectedItem(item);
    setSubmitAttempted(false);
    setForm({
      ...INITIAL_FORM,
      bankConfirmedAt: defaultDateTimeLocal(),
      settlementMethod: item.businessSnapshot?.settlementMethod ?? 'BANK_TRANSFER',
      settlementCurrency: item.businessSnapshot?.settlementCurrency ?? item.currency,
      accountingCashAccountId: '',
    });
  };

  const closeConfirmModal = () => {
    if (isConfirming) return;
    setSelectedItem(null);
    setForm(INITIAL_FORM);
    setSubmitAttempted(false);
  };

  const updateForm = (key: keyof ConfirmationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateFormFromInput =
    (key: keyof ConfirmationForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateForm(key, event.target.value);
    };

  const submitConfirmation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) return;
    setSubmitAttempted(true);
    if (!sourceSettlementMethod && !form.settlementMethod) return;
    if (selectedRequiresCashAccount && !form.accountingCashAccountId) return;
    await onConfirm(selectedItem, {
      bankConfirmedAt: new Date(form.bankConfirmedAt).toISOString(),
      bankReference: form.bankReference.trim() || undefined,
      accountingCashAccountId: selectedRequiresCashAccount
        ? form.accountingCashAccountId || undefined
        : undefined,
      settlementMethod: sourceSettlementMethod ? undefined : form.settlementMethod,
      settlementCurrency: sourceSettlementCurrency
        ? undefined
        : selectedSettlementCurrency || selectedItem.currency,
      confirmedExchangeRate: toOptionalNumber(form.confirmedExchangeRate),
      bankChargeAmount: toOptionalNumber(form.bankChargeAmount),
      notes: form.notes.trim() || undefined,
    });
    setSelectedItem(null);
    setForm(INITIAL_FORM);
  };

  const columns: Column<AccountingBankConfirmationWorkItem>[] = [
    {
      key: 'sourceModule',
      label: 'Source Module',
      width: '145px',
      render: (row) => (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {row.sourceModule}
        </span>
      ),
    },
    {
      key: 'transactionType',
      label: 'Transaction',
      width: '190px',
      render: (row) => (
        <span className="text-sm text-gray-700">{transactionTypeLabel(row.transactionType)}</span>
      ),
    },
    // {
    //   key: 'direction',
    //   label: 'Direction',
    //   width: '110px',
    //   render: (row) => (
    //     <span className="text-sm font-semibold text-gray-800">{directionLabel(row.direction)}</span>
    //   ),
    // },
    {
      key: 'operationalDate',
      label: 'Operational Date',
      width: '120px',
      render: (row) => (
        <span className="text-sm text-gray-700">{fmtDate(row.operationalDate)}</span>
      ),
    },
    {
      key: 'counterparty',
      label: 'Customer',
      width: 'minmax(180px, 1fr)',
      render: (row) => (
        <span className="text-sm font-medium text-gray-900">{row.counterpartyName}</span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: '180px',
      render: (row) => <span className="text-sm text-gray-700">{row.sourceDescription}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="block text-right text-sm font-semibold text-gray-900">
          {fmtAmount(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '160px',
      className: 'pr-6',
      render: (row) =>
        row.availableConfirmationActions.includes('CONFIRM_BANK_PAYMENT') ||
        row.availableConfirmationActions.includes('CONFIRM_BANK_RECEIPT') ? (
          <TableButton variant="green" onClick={() => openConfirmModal(row)}>
            {confirmationActionLabel(row)}
          </TableButton>
        ) : null,
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={paged}
          isLoading={isLoading}
          searchPlaceholder="Search source, counterparty or reference..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          emptyMessage={
            isError
              ? 'Data unavailable. Core Accounting remains available.'
              : 'No payments are awaiting confirmation'
          }
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <SidePanel
        isOpen={!!selectedItem}
        onClose={closeConfirmModal}
        title={selectedConfirmationTitle}
        description="Capture the Accounting confirmation facts for this transaction."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeConfirmModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="confirm-source-bank-payment-form"
              isLoading={isConfirming}
              loadingText="Confirming..."
            >
              {selectedConfirmationTitle}
            </Button>
          </div>
        }
      >
        {selectedItem && (
          <form
            id="confirm-source-bank-payment-form"
            className="mt-5 space-y-(--field-stack-gap,0.75rem)"
            onSubmit={submitConfirmation}
          >
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{selectedItem.counterpartyName}</div>
              <div className="mt-1">
                {selectedItem.sourceDescription} -{' '}
                {fmtAmount(selectedItem.amount, selectedItem.currency)}
              </div>
              <div className="mt-1">Source module: {selectedItem.sourceModule}</div>
              <div className="mt-1">
                Transaction: {transactionTypeLabel(selectedItem.transactionType)}
              </div>
              <div className="mt-1">
                Operational ref: {selectedItem.operationalReference ?? '-'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Placement</div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.placementReference)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Endorsement</div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.endorsementReference)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Closing</div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.closingReference)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Obligation Currency
                  </div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.obligationCurrency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Settlement Method
                  </div>
                  <div className="font-medium text-slate-900">
                    {sourceSettlementMethod
                      ? methodLabel(sourceSettlementMethod)
                      : 'Missing - Accounting will complete'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Settlement Currency
                  </div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(sourceSettlementCurrency, 'Missing - Accounting will complete')}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Cedant FX Source
                  </div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.cedantPaymentFxRate, 'Not linked')}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">NIC Levy</div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.nicLevyAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Contractual WHT
                  </div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.contractualWithholdingTaxAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Credit Note Source
                  </div>
                  <div className="font-medium text-slate-900">
                    {fieldValue(selectedItem.businessSnapshot?.creditNoteReference)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Confirmation Date"
                type="datetime-local"
                value={form.bankConfirmedAt}
                onChange={updateFormFromInput('bankConfirmedAt')}
                required
              />
              {!sourceSettlementMethod && (
                <SearchSelect
                  label="Settlement Method"
                  placeholder="Select settlement method…"
                  options={SETTLEMENT_METHOD_OPTIONS}
                  value={form.settlementMethod}
                  onChange={(value) => updateForm('settlementMethod', value)}
                  error={
                    submitAttempted && !form.settlementMethod
                      ? 'Settlement method is required'
                      : undefined
                  }
                />
              )}
              {!sourceSettlementCurrency && (
                <Input
                  label="Settlement Currency"
                  value={form.settlementCurrency}
                  onChange={updateFormFromInput('settlementCurrency')}
                  maxLength={3}
                  required
                />
              )}
              {selectedRequiresCashAccount && (
                <div className="flex flex-col gap-1">
                  <SearchSelect
                    label="Accounting Cash/Bank Account"
                    placeholder={
                      cashAccountOptions.isLoading
                        ? 'Loading cash accounts…'
                        : `Select ${selectedSettlementCurrency || 'settlement'} cash account…`
                    }
                    options={cashAccountOptions.options}
                    value={form.accountingCashAccountId}
                    onChange={(value) => updateForm('accountingCashAccountId', value)}
                    error={
                      submitAttempted && !form.accountingCashAccountId
                        ? 'Cash/bank account is required'
                        : undefined
                    }
                  />
                  {cashAccountOptions.isError && (
                    <span className="text-xs text-red-600">
                      Unable to load Accounting cash accounts.
                    </span>
                  )}
                  {!cashAccountOptions.isLoading &&
                    !cashAccountOptions.isError &&
                    cashAccountOptions.options.length === 0 && (
                      <span className="text-xs text-amber-700">
                        No active Accounting cash account is configured for{' '}
                        {selectedSettlementCurrency || 'this currency'}.
                      </span>
                    )}
                </div>
              )}
              {!selectedHasOperationalReference && (
                <Input
                  label={confirmationReferenceLabel(selectedSettlementMethod)}
                  value={form.bankReference}
                  onChange={updateFormFromInput('bankReference')}
                  maxLength={100}
                  required={methodRequiresReference(selectedSettlementMethod)}
                />
              )}
              <Input
                label="Confirmed FX Rate"
                type="number"
                step="0.000001"
                min="0"
                value={form.confirmedExchangeRate}
                onChange={updateFormFromInput('confirmedExchangeRate')}
              />
              {methodAffectsCash(selectedSettlementMethod) && (
                <Input
                  label="Bank Charges"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.bankChargeAmount}
                  onChange={updateFormFromInput('bankChargeAmount')}
                />
              )}
            </div>

            {!methodAffectsCash(selectedSettlementMethod) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This settlement method does not represent a bank/cash movement. The event will
                expose that fact so Accounting posting rules avoid cash-impact lines.
              </div>
            )}

            <Input
              label="Confirmation Notes"
              type="textarea"
              rows={4}
              value={form.notes}
              onChange={updateFormFromInput('notes')}
              maxLength={1000}
            />
          </form>
        )}
      </SidePanel>
    </>
  );
}
