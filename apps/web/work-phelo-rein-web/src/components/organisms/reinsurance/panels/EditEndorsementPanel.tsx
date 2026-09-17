'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, UseFormReturn, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormSection } from '@/components/atoms/FormSection';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import {
  Facultative,
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  PlacementEndorsement,
  RiskType,
} from '@/types/reinsurance';
import { useUpdateEndorsement, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { toDateOnly } from '@/lib/utils';
import {
  extractPlacementCustomFields,
  extractRiskDetailsVisibility,
  mergePlacementRiskDetails,
  splitPlacementDetails,
} from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

type EditEndorsementFormValues = FacultativeFormValues & { effectiveDate: string };

interface EditEndorsementPanelProps {
  isOpen: boolean;
  placement: Facultative;
  endorsement: PlacementEndorsement;
  onClose: () => void;
}

function endorsementToFormValues(
  placement: Facultative,
  endorsement: PlacementEndorsement,
  allRiskTypes: RiskType[],
): EditEndorsementFormValues {
  const snap = (endorsement.proposedSnapshot ?? {}) as Record<string, unknown>;
  const businessDetails =
    (snap.businessDetails as Record<string, unknown> | null) ?? placement.businessDetails;
  const offerDetails =
    (snap.offerDetails as Record<string, unknown> | null) ?? placement.offerDetails;
  const riskTypeId = String(snap.riskTypeId ?? placement.riskTypeId ?? '');
  const selectedRiskType = allRiskTypes.find((rt) => rt.id === riskTypeId);
  const schemaKeys = new Set(
    (selectedRiskType?.fields ?? []).filter((f) => f.isActive).map((f) => f.fieldKey),
  );
  return {
    ...FACULTATIVE_FORM_DEFAULTS,
    insuranceCompany: placement.cedant.id,
    riskType: riskTypeId,
    reference: String(snap.reference ?? placement.reference ?? ''),
    policyNumber: String(snap.policyNumber ?? placement.policyNumber ?? ''),
    title: String(snap.title ?? placement.title ?? ''),
    sumInsured: (snap.sumInsured ?? placement.sumInsured ?? '') as number | '',
    rate: (snap.rate ?? placement.rate ?? '') as number | '',
    premium: (snap.premium ?? placement.premium ?? '') as number | '',
    facultativeOffer: (snap.facultativeOffer ?? placement.facultativeOffer ?? '') as number | '',
    commission: (snap.commission ?? placement.commission ?? '') as number | '',
    currency: String(snap.currency ?? placement.currency ?? ''),
    periodFrom: String(snap.inceptionDate ?? placement.inceptionDate ?? ''),
    periodTo: String(snap.expiryDate ?? placement.expiryDate ?? ''),
    riskDetails: mergePlacementRiskDetails(businessDetails, offerDetails),
    riskDetailsVisibility: extractRiskDetailsVisibility(businessDetails, offerDetails),
    extraRiskFields: extractPlacementCustomFields(businessDetails, offerDetails, schemaKeys),
    comment: endorsement.reason ?? '',
    effectiveDate: endorsement.effectiveDate
      ? endorsement.effectiveDate.split('T')[0]
      : new Date().toISOString().split('T')[0],
  };
}

export function EditEndorsementPanel({
  isOpen,
  placement,
  endorsement,
  onClose,
}: EditEndorsementPanelProps) {
  const { mutateAsync: updateEndorsement, isPending } = useUpdateEndorsement(placement.id);
  const { data: allRiskTypes = [] } = useRiskTypes();
  const toast = useToastStore.getState;
  const [pendingValues, setPendingValues] = useState<EditEndorsementFormValues | null>(null);
  const [confirmDate, setConfirmDate] = useState('');

  const form = useForm<EditEndorsementFormValues>({
    defaultValues: endorsementToFormValues(placement, endorsement, allRiskTypes),
  });

  const {
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  // The offer's own period bounds — the effective date of an endorsement can't fall
  // outside the coverage period it's amending. Normalized to date-only since periodFrom/
  // periodTo may arrive as full ISO timestamps while effectiveDate is always YYYY-MM-DD.
  const periodFrom = toDateOnly(useWatch({ control, name: 'periodFrom' }));
  const periodTo = toDateOnly(useWatch({ control, name: 'periodTo' }));

  // Only reset when the panel transitions closed → open, not on every re-fetch of `placement`
  // or `endorsement` while it's already open — otherwise unsaved edits (e.g. a newly added
  // extra field) get silently wiped by background query invalidations on the same tab.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      reset(endorsementToFormValues(placement, endorsement, allRiskTypes));
    }
    wasOpen.current = isOpen;
  }, [isOpen, placement, endorsement, allRiskTypes, reset]);

  const handleClose = () => {
    reset();
    setPendingValues(null);
    onClose();
  };

  // If the endorsement doesn't already have a saved effective date, the field falls back to
  // today's date. Gate submission behind a confirmation step when the user leaves that
  // fallback untouched, so it's not silently mistaken for an intentional choice.
  const onSubmit = (values: EditEndorsementFormValues) => {
    if (!endorsement.effectiveDate && !dirtyFields.effectiveDate) {
      setConfirmDate(values.effectiveDate);
      setPendingValues(values);
      return;
    }
    void submitEndorsement(values);
  };

  const confirmPendingDate = () => {
    if (!pendingValues) return;
    const pendingPeriodFrom = toDateOnly(pendingValues.periodFrom);
    const pendingPeriodTo = toDateOnly(pendingValues.periodTo);
    if (pendingPeriodFrom && confirmDate < pendingPeriodFrom) return;
    if (pendingPeriodTo && confirmDate > pendingPeriodTo) return;
    setValue('effectiveDate', confirmDate, { shouldDirty: true });
    void submitEndorsement({ ...pendingValues, effectiveDate: confirmDate });
  };

  const submitEndorsement = async (values: EditEndorsementFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
        values.riskDetailsVisibility ?? {},
      );

      await updateEndorsement({
        endorsementId: endorsement.id,
        type: endorsement.type,
        effectiveDate: new Date(values.effectiveDate).toISOString(),
        reason: values.comment?.trim() || endorsement.reason,
        proposedSnapshot: {
          riskTypeId: values.riskType || undefined,
          reference: values.reference,
          policyNumber: values.policyNumber,
          title: values.title,
          sumInsured: values.sumInsured as number,
          rate: values.rate as number,
          premium: values.premium as number,
          facultativeOffer: values.facultativeOffer as number,
          commission: values.commission as number,
          currency: values.currency,
          inceptionDate: values.periodFrom || undefined,
          expiryDate: values.periodTo || undefined,
          ...(businessDetails ? { businessDetails } : {}),
          ...(offerDetails ? { offerDetails } : {}),
        },
      });

      toast().addToast({ message: 'Endorsement updated successfully', type: 'success' });
      handleClose();
    } catch (error) {
      setPendingValues(null);
      toast().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const pendingPeriodFrom = toDateOnly(pendingValues?.periodFrom);
  const pendingPeriodTo = toDateOnly(pendingValues?.periodTo);
  const confirmDateError = !pendingValues
    ? undefined
    : pendingPeriodFrom && confirmDate < pendingPeriodFrom
      ? 'Effective date cannot be before the offer inception date'
      : pendingPeriodTo && confirmDate > pendingPeriodTo
        ? 'Effective date cannot be after the offer expiry date'
        : undefined;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Endorsement"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isPending} loadingText="Saving…">
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <FormSection title="Endorsement Details">
          <Controller
            name="effectiveDate"
            control={control}
            rules={{
              required: 'Effective date is required',
              validate: (value) => {
                if (periodFrom && value < periodFrom) {
                  return 'Effective date cannot be before the offer inception date';
                }
                if (periodTo && value > periodTo) {
                  return 'Effective date cannot be after the offer expiry date';
                }
                return true;
              },
            }}
            render={({ field }) => (
              <DatePicker
                label="Effective Date"
                value={field.value}
                onChange={field.onChange}
                minDate={periodFrom || undefined}
                maxDate={periodTo || undefined}
                error={errors.effectiveDate?.message}
              />
            )}
          />
        </FormSection>

        <FacultativeFormFields
          form={form as unknown as UseFormReturn<FacultativeFormValues>}
          commentLabel="Reason for Endorsement"
        />
      </div>

      <Modal
        isOpen={!!pendingValues}
        onClose={() => setPendingValues(null)}
        title="Confirm Effective Date"
        description={`You haven't selected an effective date, so it defaulted to today (${todayFormatted}). Confirm this date or pick another.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingValues(null)}>
              Go Back
            </Button>
            <Button
              onClick={confirmPendingDate}
              isLoading={isPending}
              loadingText="Saving…"
              disabled={!!confirmDateError}
            >
              Confirm &amp; Save
            </Button>
          </>
        }
      >
        <div className="mt-4">
          <DatePicker
            label="Effective Date"
            value={confirmDate}
            onChange={setConfirmDate}
            minDate={pendingPeriodFrom || undefined}
            maxDate={pendingPeriodTo || undefined}
            error={confirmDateError}
          />
        </div>
      </Modal>
    </SidePanel>
  );
}
