'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import FacultativeFormFields from '@/components/molecules/reinsurance/forms/FacultativeFormFields';
import { FacultativeFormValues, FACULTATIVE_FORM_DEFAULTS } from '@/types/reinsurance';
import { useCreateFacultative, useNextFacultativeReference, useRiskTypes } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { normalizeComment, splitPlacementDetails } from '@/lib/reinsurance/placementFormDetails';
import { useToastStore } from '@/store/toast.store';

interface CreateFacultativePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFacultativePanel({ isOpen, onClose }: CreateFacultativePanelProps) {
  const form = useForm<FacultativeFormValues>({
    defaultValues: FACULTATIVE_FORM_DEFAULTS,
  });

  const {
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = form;

  const [created, setCreated] = useState<{ policyNumber: string } | null>(null);

  const { mutateAsync: createFacultative } = useCreateFacultative();
  const { data: allRiskTypes = [] } = useRiskTypes();
  const {
    data: generatedReference,
    isError: isReferenceError,
    isFetching: isReferenceFetching,
    refetch: refetchReference,
  } = useNextFacultativeReference(isOpen);

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
      setCreated({ policyNumber: values.policyNumber?.trim() ?? '' });
      handleClose();
    } catch (error) {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <>
      <SuccessModal
        isOpen={!!created}
        onClose={() => setCreated(null)}
        title="Offer Created!"
        message={
          created?.policyNumber
            ? `Offer ${created.policyNumber} has been created successfully.`
            : 'The offer has been created successfully.'
        }
        actionLabel="Done"
      />
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title="Facultative Placement Slip"
        footer={
          <div className="flex items-center justify-end gap-3">
            {isReferenceError && (
              <p className="mr-auto text-sm text-red-600">
                Couldn&apos;t generate a reference number
              </p>
            )}
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {isReferenceError ? (
              <Button
                onClick={() => refetchReference()}
                isLoading={isReferenceFetching}
                loadingText="Retrying…"
              >
                Retry
              </Button>
            ) : (
              <Button
                onClick={handleSubmit(onSubmit)}
                isLoading={isSubmitting}
                disabled={!generatedReference}
                loadingText="Saving…"
              >
                Save
              </Button>
            )}
          </div>
        }
      >
        <FacultativeFormFields form={form} />
      </SidePanel>
    </>
  );
}
