'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CreatableSearchSelect, CreatableOption } from '@/components/atoms/CreatableSearchSelect';
import {
  PostingRuleDirection,
  PostingRuleLineInput,
  PostingRuleSubledgerType,
} from '@/types/accounting';
import { useCreatePostingRule, useGLAccountOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { getPostingRulePathGuidance } from '@/config/reinsurance-posting-rule-guidance';
import {
  EVENT_TEMPLATES,
  EVENT_TEMPLATE_BY_TYPE,
  type EventTemplateLine,
} from '@/config/reinsurance-event-catalog';
import { cn } from '@/lib/utils';

interface AddPostingRulePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type LineFormValues = {
  direction: PostingRuleDirection | '';
  glAccountId: string;
  subledgerType: PostingRuleSubledgerType | '';
  subledgerExternalRefSource: string;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
  /** Guided mode only — what this line represents in plain language. Not sent to the API. */
  roleLabel?: string;
};

type FormValues = {
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number | '';
  effectiveFrom: string;
  effectiveTo: string;
  lines: LineFormValues[];
};

const EMPTY_LINE: LineFormValues = {
  direction: '',
  glAccountId: '',
  subledgerType: '',
  subledgerExternalRefSource: '',
  amountSource: '',
  currencySource: '',
  descriptionTemplate: '',
};

const DEFAULTS: FormValues = {
  name: '',
  sourceModule: 'REINSURANCE',
  sourceEventType: '',
  version: 1,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  lines: [
    { ...EMPTY_LINE, direction: 'DR' },
    { ...EMPTY_LINE, direction: 'CR' },
  ],
};

// Guided event templates — see @/config/reinsurance-event-catalog for the
// full catalog. Picking a template pre-fills the correct DR/CR direction,
// subledger tag, external ref path, and amount path — the details that trip
// people up (e.g. the "must preserve CEDANT_PREMIUM_AR using a CEDANT
// subledger line" error) — so the user only has to choose which GL account
// plays each role.

const GUIDED_EVENT_OPTIONS: SearchSelectOption[] = EVENT_TEMPLATES.map((t) => ({
  value: t.eventType,
  label: t.label,
  sublabel: t.controlDimensionLabel,
}));

// Advanced mode: free-text entry still works via CreatableSearchSelect for
// anything not in the guided catalog — see ACTIVE_REINSURANCE_ACCOUNTING_EVENT_TYPES
// on the reinsurance-service side.
const SOURCE_EVENT_TYPE_OPTIONS: CreatableOption[] = EVENT_TEMPLATES.map((t) => ({
  value: t.eventType,
  label: t.label,
}));

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

function lineFromTemplate(line: EventTemplateLine): LineFormValues {
  return {
    direction: line.direction,
    glAccountId: '',
    subledgerType: line.subledgerType ?? '',
    subledgerExternalRefSource: line.subledgerExternalRefSource ?? '',
    amountSource: line.amountSource,
    currencySource: 'currency',
    descriptionTemplate: '',
    roleLabel: line.roleLabel,
  };
}

export function AddPostingRulePanel({ isOpen, onClose }: AddPostingRulePanelProps) {
  const toast = useToast();
  const { mutateAsync: createRule, isPending } = useCreatePostingRule();
  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();
  const [mode, setMode] = useState<'guided' | 'advanced'>('guided');

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lines' });
  const sourceModule = useWatch({ control, name: 'sourceModule' });
  const sourceEventType = useWatch({ control, name: 'sourceEventType' });
  const pathGuidance = getPostingRulePathGuidance(sourceModule, sourceEventType);
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

  const handleClose = () => {
    reset(DEFAULTS);
    setMode('guided');
    onClose();
  };

  const handleSelectGuidedEvent = (eventType: string) => {
    const template = EVENT_TEMPLATE_BY_TYPE.get(eventType);
    setValue('sourceEventType', eventType, { shouldValidate: true });
    if (template) {
      replace(template.lines.map(lineFromTemplate));
    }
  };

  const onSubmit = async (data: FormValues) => {
    const lines: PostingRuleLineInput[] = data.lines
      .filter((line) => line.direction && line.glAccountId && line.amountSource)
      .map((line, index) => ({
        sequence: index + 1,
        direction: line.direction as PostingRuleDirection,
        glAccountId: line.glAccountId,
        subledgerType: line.subledgerType || undefined,
        subledgerExternalRefSource: line.subledgerExternalRefSource || undefined,
        amountSource: line.amountSource,
        currencySource: line.currencySource || 'currency',
        descriptionTemplate: line.descriptionTemplate || `${data.name} — {{sourceRecordId}}`,
      }));

    if (lines.length < 2) {
      toast.error('A posting rule needs at least 2 lines.');
      return;
    }
    const debitCount = lines.filter((l) => l.direction === 'DR').length;
    const creditCount = lines.filter((l) => l.direction === 'CR').length;
    if (debitCount === 0 || creditCount === 0) {
      toast.error('A posting rule needs at least one debit line and one credit line.');
      return;
    }

    try {
      await createRule({
        name: data.name,
        sourceModule: data.sourceModule,
        sourceEventType: data.sourceEventType,
        version: Number(data.version),
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || undefined,
        lines,
      });
      toast.success(
        'Posting rule created as inactive. Activate it once you’ve reviewed the lines.',
      );
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create posting rule'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Posting Rule"
      description={
        mode === 'guided'
          ? 'Pick the business event — the required debit/credit lines are filled in for you. Just choose the GL accounts.'
          : 'Map a source business event to the balanced journal lines it should post. Created inactive — review before activating.'
      }
      descriptionAction={
        <button
          type="button"
          onClick={() => setMode(mode === 'guided' ? 'advanced' : 'guided')}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700"
        >
          {mode === 'guided' ? 'Advanced setup' : 'Back to guided setup'}
        </button>
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Posting Rule
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Rule Name"
          registration={register('name', { required: 'Name is required' })}
          error={errors.name}
          placeholder="e.g. Premium debit note issued"
        />

        {mode === 'advanced' && (
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Source Module"
              registration={register('sourceModule', {
                required: 'Source module is required',
                setValueAs: (v: string) => v.toUpperCase(),
              })}
              error={errors.sourceModule}
              placeholder="e.g. REINSURANCE"
            />
            <FormField
              label="Version"
              type="number"
              registration={register('version', {
                required: 'Version is required',
                min: { value: 1, message: 'Version must be at least 1' },
                valueAsNumber: true,
              })}
              error={errors.version}
            />
          </div>
        )}

        {mode === 'guided' ? (
          <Controller
            name="sourceEventType"
            control={control}
            rules={{ required: 'Select a business event' }}
            render={({ field }) => (
              <>
                <SearchSelect
                  label="Business Event"
                  placeholder="Select the event this rule handles…"
                  options={GUIDED_EVENT_OPTIONS}
                  value={field.value}
                  onChange={handleSelectGuidedEvent}
                  error={errors.sourceEventType?.message}
                />
                {EVENT_TEMPLATE_BY_TYPE.get(field.value) && (
                  <p className="-mt-1 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
                    {EVENT_TEMPLATE_BY_TYPE.get(field.value)?.description}
                  </p>
                )}
              </>
            )}
          />
        ) : (
          <Controller
            name="sourceEventType"
            control={control}
            rules={{ required: 'Source event type is required' }}
            render={({ field }) => (
              <CreatableSearchSelect
                label="Source Event Type"
                placeholder="Select or type an event type…"
                options={SOURCE_EVENT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.sourceEventType?.message}
              />
            )}
          />
        )}

        <div className={cn('grid gap-3', mode === 'advanced' ? 'grid-cols-2' : 'grid-cols-1')}>
          <FormField
            label="Effective From"
            type="date"
            registration={register('effectiveFrom', { required: 'Effective from is required' })}
            error={errors.effectiveFrom}
          />
          {mode === 'advanced' && (
            <FormField
              label="Effective To"
              type="date"
              registration={register('effectiveTo')}
              error={errors.effectiveTo}
              placeholder="Optional — open-ended if blank"
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Lines</span>
            {mode === 'advanced' && (
              <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_LINE })}>
                Add Line
              </Button>
            )}
          </div>

          {fields.map((field, index) => {
            const roleLabel =
              field.roleLabel ||
              (field.subledgerType ? `${field.subledgerType} control line` : `Line ${index + 1}`);

            if (mode === 'guided') {
              return (
                <div
                  key={field.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-bold',
                          field.direction === 'DR'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {field.direction || '—'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{roleLabel}</span>
                    </div>
                    {field.subledgerType && (
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                        {field.subledgerType} subledger
                      </span>
                    )}
                  </div>
                  <Controller
                    name={`lines.${index}.glAccountId`}
                    control={control}
                    rules={{ required: 'Required' }}
                    render={({ field: f }) => (
                      <SearchSelect
                        label="GL Account"
                        placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
                        options={glAccountOptions}
                        value={f.value}
                        onChange={f.onChange}
                        error={errors.lines?.[index]?.glAccountId?.message}
                      />
                    )}
                  />
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Line {index + 1}</span>
                  {fields.length > 2 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    name={`lines.${index}.direction`}
                    control={control}
                    rules={{ required: 'Required' }}
                    render={({ field: f }) => (
                      <SearchSelect
                        label="Direction"
                        placeholder="Select…"
                        options={DIRECTION_OPTIONS}
                        value={f.value}
                        onChange={f.onChange}
                        error={errors.lines?.[index]?.direction?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`lines.${index}.glAccountId`}
                    control={control}
                    rules={{ required: 'Required' }}
                    render={({ field: f }) => (
                      <SearchSelect
                        label="GL Account"
                        placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
                        options={glAccountOptions}
                        value={f.value}
                        onChange={f.onChange}
                        error={errors.lines?.[index]?.glAccountId?.message}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    name={`lines.${index}.subledgerType`}
                    control={control}
                    render={({ field: f }) => (
                      <SearchSelect
                        label="Subledger Type (optional)"
                        placeholder="None — control account only"
                        options={SUBLEDGER_TYPE_OPTIONS}
                        value={f.value}
                        onChange={f.onChange}
                      />
                    )}
                  />
                  <Controller
                    name={`lines.${index}.subledgerExternalRefSource`}
                    control={control}
                    render={({ field: f }) => (
                      <CreatableSearchSelect
                        label="Subledger Ref Source"
                        placeholder="e.g. counterparty.id"
                        options={subledgerReferenceOptions}
                        value={f.value}
                        onChange={f.onChange}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    name={`lines.${index}.amountSource`}
                    control={control}
                    rules={{ required: 'Required' }}
                    render={({ field: f }) => (
                      <CreatableSearchSelect
                        label="Amount Source"
                        placeholder="e.g. amounts.netPremium"
                        options={amountSourceOptions}
                        value={f.value}
                        onChange={f.onChange}
                        error={errors.lines?.[index]?.amountSource?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`lines.${index}.currencySource`}
                    control={control}
                    render={({ field: f }) => (
                      <CreatableSearchSelect
                        label="Currency Source"
                        placeholder="Defaults to “currency”"
                        options={currencySourceOptions}
                        value={f.value}
                        onChange={f.onChange}
                      />
                    )}
                  />
                </div>

                <FormField
                  label="Description Template"
                  registration={register(`lines.${index}.descriptionTemplate`)}
                  placeholder="Defaults to the rule name + {{sourceRecordId}}"
                />
              </div>
            );
          })}
        </div>
      </div>
    </SidePanel>
  );
}
