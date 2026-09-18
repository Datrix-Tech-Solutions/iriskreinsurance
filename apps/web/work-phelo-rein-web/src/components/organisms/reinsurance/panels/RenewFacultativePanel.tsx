'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import { Facultative, FacultativeFormValues } from '@/types/reinsurance';
import { useCreateFacultative, useNextFacultativeReference, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import {
  normalizeComment,
  placementToFormValues,
  splitPlacementDetails,
} from '@/lib/reinsurance/placementFormDetails';
import { computeRenewalPeriod } from '@/lib/reinsurance/renewalDates';
import { useToastStore } from '@/store/toast.store';

interface RenewFacultativePanelProps {
  isOpen: boolean;
  placement: Facultative;
  onClose: () => void;
}

export function RenewFacultativePanel({ isOpen, placement, onClose }: RenewFacultativePanelProps) {
  const { data: allRiskTypes = [] } = useRiskTypes();
  const { data: generatedReference } = useNextFacultativeReference(isOpen);

  const form = useForm<FacultativeFormValues>({
    defaultValues: placementToFormValues(placement, allRiskTypes),
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = form;

  const { mutateAsync: createFacultative } = useCreateFacultative();

  useEffect(() => {
    if (!isOpen) return;
    const { periodFrom, periodTo } = computeRenewalPeriod(
      placement.inceptionDate,
      placement.expiryDate,
    );
    reset({
      ...placementToFormValues(placement, allRiskTypes),
      periodFrom,
      periodTo,
    });
  }, [isOpen, placement, allRiskTypes, reset]);

  useEffect(() => {
    if (isOpen && generatedReference) {
      setValue('reference', generatedReference);
    }
  }, [isOpen, generatedReference, setValue]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: FacultativeFormValues) => {
    try {
      const selectedRiskType = allRiskTypes.find((rt) => rt.id === values.riskType);
      const { businessDetails, offerDetails } = splitPlacementDetails(
        values.riskDetails,
        selectedRiskType?.fields ?? [],
        values.extraRiskFields ?? [],
        values.riskDetailsVisibility ?? {},
      );

      await createFacultative({
        cedantId: values.insuranceCompany,
        riskTypeId: values.riskType,
        reference: values.reference,
        policyNumber: values.policyNumber || undefined,
        title: values.title,
        description: normalizeComment(values.comment),
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
      });
      useToastStore
        .getState()
        .addToast({ message: 'Renewal offer created successfully', type: 'success' });
      handleClose();
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Renew Facultative Placement"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            disabled={!generatedReference}
            loadingText="Saving…"
          >
            Create Renewal
          </Button>
        </div>
      }
    >
      <FacultativeFormFields form={form} />
    </SidePanel>
  );
}
