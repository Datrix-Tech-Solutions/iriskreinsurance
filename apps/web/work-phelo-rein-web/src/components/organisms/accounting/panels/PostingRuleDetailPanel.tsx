'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CreatableSearchSelect, CreatableOption } from '@/components/atoms/CreatableSearchSelect';
import {
  PostingRule,
  PostingRuleDirection,
  PostingRuleLine,
  PostingRuleSubledgerType,
} from '@/types/accounting';
import {
  useCreatePostingRuleLine,
  useDeactivatePostingRule,
  useDeletePostingRuleLine,
  useGLAccountOptions,
  useUpdatePostingRule,
  useUpdatePostingRuleLine,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { getPostingRulePathGuidance } from '@/config/reinsurance-posting-rule-guidance';
import { getSourceEventLabel } from '@/config/reinsurance-event-catalog';

interface PostingRuleDetailPanelProps {
  rule: PostingRule | null;
  onClose: () => void;
  onAddLine: () => void;
  onEditLine: (line: PostingRuleLine) => void;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export function PostingRuleDetailPanel({
  rule,
  onClose,
  onAddLine,
  onEditLine,
}: PostingRuleDetailPanelProps) {
  const toast = useToast();
  const updateRule = useUpdatePostingRule();
  const deactivateRule = useDeactivatePostingRule();
  const deleteLine = useDeletePostingRuleLine();

  const handleToggleActive = async () => {
    if (!rule) return;
    try {
      if (rule.active) {
        await deactivateRule.mutateAsync(rule.id);
        toast.success('Posting rule deactivated.');
      } else {
        await updateRule.mutateAsync({ id: rule.id, active: true });
        toast.success('Posting rule activated.');
      }
    } catch (err) {
      toast.error(extractError(err, 'Failed to update posting rule'));
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!rule) return;
    try {
      await deleteLine.mutateAsync({ ruleId: rule.id, lineId });
      toast.success('Line removed.');
    } catch (err) {
      toast.error(extractError(err, 'Failed to remove line'));
    }
  };

  return (
    <SidePanel
      isOpen={!!rule}
      onClose={onClose}
      title={rule?.name ?? 'Posting Rule'}
      description={
        rule
          ? `${rule.sourceModule} · ${getSourceEventLabel(rule.sourceEventType)} · v${rule.version}`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant={rule?.active ? 'danger' : 'primary'}
            isLoading={updateRule.isPending || deactivateRule.isPending}
            loadingText="Saving…"
            onClick={handleToggleActive}
          >
            {rule?.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      }
    >
      {rule && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge
              label={rule.active ? 'Active' : 'Inactive'}
              variant={rule.active ? 'success' : 'neutral'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Source Module" value={rule.sourceModule} />
            <Field label="Source Event Type" value={getSourceEventLabel(rule.sourceEventType)} />
            <Field label="Version" value={rule.version} />
            <Field label="Effective From" value={fmtDate(rule.effectiveFrom)} />
            <Field label="Effective To" value={fmtDate(rule.effectiveTo)} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                Lines ({rule.lines.length})
              </span>
              <Button type="button" variant="outline" onClick={onAddLine}>
                Add Line
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Dir</th>
                    <th className="px-3 py-2 text-left font-medium">GL Account</th>
                    <th className="px-3 py-2 text-left font-medium">Amount Source</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-500">{line.sequence}</td>
                      <td className="px-3 py-2">
                        <Badge
                          label={line.direction}
                          variant={line.direction === 'DR' ? 'info' : 'warning'}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {line.glAccount.code} – {line.glAccount.name}
                        {line.subledgerType && (
                          <div className="text-xs text-gray-400">{line.subledgerType}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{line.amountSource}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditLine(line)}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rule.lines.length < 2 && (
              <span className="text-xs text-amber-700">
                At least 2 lines (one debit, one credit) are required before this rule can be
                activated.
              </span>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}

type LineFormValues = {
  direction: PostingRuleDirection | '';
  glAccountId: string;
  subledgerType: PostingRuleSubledgerType | '';
  subledgerExternalRefSource: string;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
};

const LINE_DEFAULTS: LineFormValues = {
  direction: '',
  glAccountId: '',
  subledgerType: '',
  subledgerExternalRefSource: '',
  amountSource: '',
  currencySource: '',
  descriptionTemplate: '',
};

const DIRECTION_OPTIONS: SearchSelectOption[] = [
  { value: 'DR', label: 'Debit (DR)' },
  { value: 'CR', label: 'Credit (CR)' },
];

const SUBLEDGER_TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'CEDANT', label: 'Cedant' },
  { value: 'REINSURER', label: 'Reinsurer' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'STATUTORY', label: 'Statutory' },
  { value: 'OTHER', label: 'Other' },
];

function lineToFormValues(line: PostingRuleLine): LineFormValues {
  return {
    direction: line.direction,
    glAccountId: line.glAccountId,
    subledgerType: line.subledgerType ?? '',
    subledgerExternalRefSource: line.subledgerExternalRefSource ?? '',
    amountSource: line.amountSource,
    currencySource: line.currencySource,
    descriptionTemplate: line.descriptionTemplate,
  };
}

export function PostingRuleLineFormModal({
  rule,
  line,
  onClose,
}: {
  rule: PostingRule | null;
  /** null means "add a new line"; a line means "editing this one". */
  line: PostingRuleLine | null | undefined;
  onClose: () => void;
}) {
  const toast = useToast();
  const isEdit = !!line;
  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();
  const createLine = useCreatePostingRuleLine();
  const updateLine = useUpdatePostingRuleLine();
  const isPending = createLine.isPending || updateLine.isPending;
  const pathGuidance = getPostingRulePathGuidance(rule?.sourceModule, rule?.sourceEventType);
  const amountSourceOptions: CreatableOption[] = pathGuidance.amountSources.map((value) => ({
    value,
    label: value,
  }));
  const currencySourceOptions: CreatableOption[] = pathGuidance.currencySources.map((value) => ({
    value,
    label: value,
  }));
  const subledgerReferenceOptions: CreatableOption[] = pathGuidance.subledgerReferenceSources.map(
    (value) => ({ value, label: value }),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LineFormValues>({ defaultValues: LINE_DEFAULTS });

  useEffect(() => {
    reset(line ? lineToFormValues(line) : LINE_DEFAULTS);
  }, [line, reset]);

  const handleClose = () => {
    reset(LINE_DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: LineFormValues) => {
    if (!rule) return;
    const payload = {
      sequence: line?.sequence ?? rule.lines.length + 1,
      direction: data.direction as PostingRuleDirection,
      glAccountId: data.glAccountId,
      subledgerType: data.subledgerType || undefined,
      subledgerExternalRefSource: data.subledgerExternalRefSource || undefined,
      amountSource: data.amountSource,
      currencySource: data.currencySource || 'currency',
      descriptionTemplate: data.descriptionTemplate || `${rule.name} — {{sourceRecordId}}`,
    };

    try {
      if (isEdit && line) {
        await updateLine.mutateAsync({ ruleId: rule.id, lineId: line.id, ...payload });
        toast.success('Line updated.');
      } else {
        await createLine.mutateAsync({ ruleId: rule.id, ...payload });
        toast.success('Line added.');
      }
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save line'));
    }
  };

  return (
    <Modal
      isOpen={!!rule && line !== undefined}
      onClose={handleClose}
      title={isEdit ? 'Edit Line' : 'Add Line'}
      description="Posted journal lines are built from the source event's payload using these paths."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Line
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="direction"
            control={control}
            rules={{ required: 'Required' }}
            render={({ field }) => (
              <SearchSelect
                label="Direction"
                placeholder="Select…"
                options={DIRECTION_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.direction?.message}
              />
            )}
          />
          <Controller
            name="glAccountId"
            control={control}
            rules={{ required: 'Required' }}
            render={({ field }) => (
              <SearchSelect
                label="GL Account"
                placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
                options={glAccountOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.glAccountId?.message}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="subledgerType"
            control={control}
            render={({ field }) => (
              <SearchSelect
                label="Subledger Type (optional)"
                placeholder="None — control account only"
                options={SUBLEDGER_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="subledgerExternalRefSource"
            control={control}
            render={({ field }) => (
              <CreatableSearchSelect
                label="Subledger Ref Source"
                placeholder="e.g. counterparty.id"
                options={subledgerReferenceOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="amountSource"
            control={control}
            rules={{ required: 'Required' }}
            render={({ field }) => (
              <CreatableSearchSelect
                label="Amount Source"
                placeholder="e.g. amounts.netPremium"
                options={amountSourceOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.amountSource?.message}
              />
            )}
          />
          <Controller
            name="currencySource"
            control={control}
            render={({ field }) => (
              <CreatableSearchSelect
                label="Currency Source"
                placeholder="Defaults to “currency”"
                options={currencySourceOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <FormField
          label="Description Template"
          registration={register('descriptionTemplate')}
          placeholder="Defaults to the rule name + {{sourceRecordId}}"
        />
      </div>
    </Modal>
  );
}
