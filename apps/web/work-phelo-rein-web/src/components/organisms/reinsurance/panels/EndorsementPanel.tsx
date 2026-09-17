'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, UseFormReturn, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FormSection } from '@/components/atoms/FormSection';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import {
  EffectivePlacementView,
  Facultative,
  FacultativeFormValues,
  FACULTATIVE_FORM_DEFAULTS,
  RiskType,
} from '@/types/reinsurance';
import { useCreateEndorsement, usePlacementEffectiveView, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { toDateOnly } from '@/lib/utils';
import {
  extractPlacementCustomFields,
  extractRiskDetailsVisibility,
  mergePlacementRiskDetails,
  splitPlacementDetails,
} from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

type EndorsementFormValues = FacultativeFormValues & { effectiveDate: string };

interface EndorsementPanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
  onCreated?: () => void;
}

function placementToFormValues(
  placement: Facultative,
  allRiskTypes: RiskType[],
  effectiveView?: EffectivePlacementView,
): EndorsementFormValues {
  const effectiveTerms = effectiveView?.effectiveTerms;
  const businessDetails = effectiveTerms?.businessDetails ?? placement.businessDetails;
  const offerDetails = effectiveTerms?.offerDetails ?? placement.offerDetails;
  const riskTypeId = effectiveTerms?.riskTypeId ?? placement.riskTypeId ?? '';
  const selectedRiskType = allRiskTypes.find((rt) => rt.id === riskTypeId);
  const schemaKeys = new Set(
    (selectedRiskType?.fields ?? []).filter((f) => f.isActive).map((f) => f.fieldKey),
  );

  return {
    ...FACULTATIVE_FORM_DEFAULTS,
    insuranceCompany: effectiveTerms?.cedantId ?? placement.cedant.id,
    riskType: riskTypeId,
    reference: placement.reference,
    policyNumber: effectiveTerms?.policyNumber ?? placement.policyNumber ?? '',
    title: effectiveTerms?.title ?? placement.title,
    sumInsured: effectiveTerms?.sumInsured ?? placement.sumInsured ?? '',
    rate: effectiveTerms?.rate ?? placement.rate ?? '',
    premium: effectiveTerms?.premium ?? placement.premium ?? '',
    facultativeOffer: effectiveTerms?.facultativeOfferPercent ?? placement.facultativeOffer ?? '',
    commission: effectiveTerms?.commissionPercent ?? placement.commission ?? '',
    currency: effectiveTerms?.currency ?? placement.currency ?? '',
    periodFrom: effectiveTerms?.inceptionDate ?? placement.inceptionDate ?? '',
    periodTo: effectiveTerms?.expiryDate ?? placement.expiryDate ?? '',
    riskDetails: mergePlacementRiskDetails(businessDetails, offerDetails),
    riskDetailsVisibility: extractRiskDetailsVisibility(businessDetails, offerDetails),
    extraRiskFields: extractPlacementCustomFields(businessDetails, offerDetails, schemaKeys),
    comment: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  };
}

export function EndorsementPanel({ isOpen, placement, onClose, onCreated }: EndorsementPanelProps) {
  const { mutateAsync: createEndorsement, isPending } = useCreateEndorsement(placement.id);
  const { data: effectiveView } = usePlacementEffectiveView(placement.id, isOpen);
  const { data: allRiskTypes = [] } = useRiskTypes();
  const toast = useToastStore.getState;
  const [pendingValues, setPendingValues] = useState<EndorsementFormValues | null>(null);
  const [confirmDate, setConfirmDate] = useState('');
  const [created, setCreated] = useState<{ policyNumber: string } | null>(null);

  const form = useForm<EndorsementFormValues>({
    defaultValues: placementToFormValues(placement, allRiskTypes, effectiveView),
  });

  const {
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = form;

  // The offer's own period bounds — the effective date of an endorsement can't fall
  // outside the coverage period it's amending. Normalized to date-only since periodFrom/
  // periodTo may arrive as full ISO timestamps while effectiveDate is always YYYY-MM-DD.
  const periodFrom = toDateOnly(useWatch({ control, name: 'periodFrom' }));
  const periodTo = toDateOnly(useWatch({ control, name: 'periodTo' }));

  // Only reset when the panel transitions closed → open, not on every re-fetch of `placement`
  // while it's already open — otherwise unsaved edits (e.g. a newly added extra field) get
  // silently wiped by background query invalidations that happen on the same tab.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      reset(placementToFormValues(placement, allRiskTypes, effectiveView));
    } else if (isOpen && effectiveView && !isDirty) {
      reset(placementToFormValues(placement, allRiskTypes, effectiveView));
    }
    wasOpen.current = isOpen;
  }, [effectiveView, isDirty, isOpen, placement, allRiskTypes, reset]);

  const handleClose = () => {
    reset();
    setPendingValues(null);
    onClose();
  };

  // Always gate the actual submission behind a confirmation step — the effective date drives
  // backdating/future-dating of the endorsement, so it's worth a final check regardless of
  // whether the user left the pre-filled today's-date default or picked their own.
  const onSubmit = (values: EndorsementFormValues) => {
    setConfirmDate(values.effectiveDate);
    setPendingValues(values);
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

  const submitEndorsement = async (values: EndorsementFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
        values.riskDetailsVisibility ?? {},
      );

      const proposedSnapshot = {
        cedantId: values.insuranceCompany || undefined,
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
        businessDetails,
        offerDetails,
      };

      await createEndorsement({
        type: 'POLICY_AMENDMENT',
        effectiveDate: new Date(values.effectiveDate).toISOString(),
        reason: values.comment?.trim() || 'Policy endorsement',
        proposedSnapshot: {
          riskTypeId: proposedSnapshot.riskTypeId,
          cedantId: proposedSnapshot.cedantId,
          reference: proposedSnapshot.reference,
          policyNumber: proposedSnapshot.policyNumber,
          title: proposedSnapshot.title,
          sumInsured: proposedSnapshot.sumInsured,
          rate: proposedSnapshot.rate,
          premium: proposedSnapshot.premium,
          facultativeOffer: proposedSnapshot.facultativeOffer,
          commission: proposedSnapshot.commission,
          currency: proposedSnapshot.currency,
          inceptionDate: proposedSnapshot.inceptionDate,
          expiryDate: proposedSnapshot.expiryDate,
          ...(businessDetails ? { businessDetails } : {}),
          ...(offerDetails ? { offerDetails } : {}),
        },
        targetPercent:
          values.facultativeOffer === '' || values.facultativeOffer == null
            ? undefined
            : Number(values.facultativeOffer),
      });

      // Keep the panel mounted behind the SuccessModal; onCreated/handleClose
      // (which unmount this component at most call sites) run once it's dismissed.
      setPendingValues(null);
      setCreated({ policyNumber: values.policyNumber?.trim() ?? '' });
    } catch (error) {
      setPendingValues(null);
      toast().addToast({ message: extractError(error), type: 'error' });
    }
  };

  const handleSuccessClose = () => {
    setCreated(null);
    onCreated?.();
    handleClose();
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
    <>
      <SuccessModal
        isOpen={!!created}
        onClose={handleSuccessClose}
        title="Endorsement Created!"
        message={
          created?.policyNumber
            ? `Endorsement for offer ${created.policyNumber} has been created successfully.`
            : 'The endorsement has been created successfully.'
        }
        actionLabel="Done"
      />
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Endorse Bound Policy"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} isLoading={isPending} loadingText="Saving…">
              Create Endorsement
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
          description={
            dirtyFields.effectiveDate
              ? 'Confirm the effective date for this endorsement, or pick another.'
              : `You haven't selected an effective date, so it defaulted to today (${todayFormatted}). Confirm this date or pick another.`
          }
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
                Confirm &amp; Create
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
    </>
  );
}
