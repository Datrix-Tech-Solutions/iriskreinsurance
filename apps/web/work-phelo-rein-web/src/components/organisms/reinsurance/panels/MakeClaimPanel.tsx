'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  MakeClaimFormFields,
  MakeClaimFormValues,
  MAKE_CLAIM_DEFAULTS,
  claimStateToTag,
  claimTagToState,
} from '@/components/molecules/reinsurance/forms/MakeClaimFormFields';
import {
  useCreatePlacementClaim,
  useUpdatePlacementClaim,
  useCedants,
  useFacultativeSearch,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import {
  ClaimState,
  Facultative,
  PlacementClaim,
  UpdatePlacementClaimPayload,
} from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

interface MakeClaimPanelProps {
  isOpen: boolean;
  onClose: () => void;
  placement?: Facultative;
  claim?: PlacementClaim;
  onSuccess?: (claim: PlacementClaim) => void;
  onPlacementChange?: (placementId: string) => void;
  onPlacementResolved?: (placement: Facultative | null) => void;

  mode?: 'notification' | 'actual';
}

export function MakeClaimPanel({
  isOpen,
  onClose,
  placement,
  claim,
  onSuccess,
  onPlacementChange,
  onPlacementResolved,
  mode = 'notification',
}: MakeClaimPanelProps) {
  const isEditing = !!claim;
  const showPicker = !placement;

  const { data: cedants = [] } = useCedants();
  const [cedantId, setCedantId] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [businessQuery, setBusinessQuery] = useState('');
  const [debouncedBusinessQuery, setDebouncedBusinessQuery] = useState('');
  const [placementById, setPlacementById] = useState<Map<string, Facultative>>(() => new Map());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBusinessQuery(businessQuery), 300);
    return () => clearTimeout(timer);
  }, [businessQuery]);

  const { data: placementOptionsPage } = useFacultativeSearch(
    {
      archived: false,
      status: 'CLOSED',
      cedantId: cedantId || undefined,
      search: debouncedBusinessQuery || undefined,
    },
    { enabled: showPicker && !!cedantId, limit: 25 },
  );

  const placementOptions = useMemo(
    () => placementOptionsPage?.items ?? [],
    [placementOptionsPage?.items],
  );

  useEffect(() => {
    if (!placement) return;
    setPlacementById((current) => new Map(current).set(placement.id, placement));
  }, [placement]);

  useEffect(() => {
    if (placementOptions.length === 0) return;
    setPlacementById((current) => {
      const next = new Map(current);
      placementOptions.forEach((item) => next.set(item.id, item));
      return next;
    });
  }, [placementOptions]);

  const pickedPlacement = useMemo(() => placementById.get(businessId), [placementById, businessId]);
  const effectivePlacement = placement ?? pickedPlacement;

  useEffect(() => {
    onPlacementResolved?.(effectivePlacement ?? null);
  }, [effectivePlacement, onPlacementResolved]);

  const cedantOptions = useMemo(() => {
    return cedants
      .map((cedant) => ({ value: cedant.id, label: cedant.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cedants]);

  const businessOptions = useMemo(() => {
    const options = new Map<string, Facultative>();
    if (pickedPlacement) options.set(pickedPlacement.id, pickedPlacement);
    placementOptions
      .filter((f) => f.cedant.id === cedantId && f.status !== 'CANCELLED')
      .forEach((f) => options.set(f.id, f));

    return Array.from(options.values()).map((f) => ({
      value: f.id,
      label: displayPolicyNumber(f.policyNumber),
      sublabel: [f.classOfBusiness, f.title].filter(Boolean).join(' · '),
    }));
  }, [placementOptions, pickedPlacement, cedantId]);

  const form = useForm<MakeClaimFormValues>({ defaultValues: MAKE_CLAIM_DEFAULTS });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const createClaim = useCreatePlacementClaim();
  const updateClaim = useUpdatePlacementClaim(effectivePlacement?.id ?? '', claim?.id ?? '');
  const addToast = useToastStore((s) => s.addToast);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);

  // An edited claim that has (or had) a final loss amount is an actual claim, so the
  // claim-state selector and final-loss field are shown even when no `mode` was passed.
  const claimIsActual =
    !!claim && (claim.claimState === 'FINALIZED' || claim.finalLossAmount != null);
  const formMode: 'notification' | 'actual' = isEditing && claimIsActual ? 'actual' : mode;

  useEffect(() => {
    if (isOpen) {
      if (claim) {
        reset({
          ...MAKE_CLAIM_DEFAULTS,
          claimNumber: claim.claimNumber,
          claimTag: claimStateToTag(
            claim.claimState ?? (claim.finalLossAmount != null ? 'FINALIZED' : 'PENDING'),
          ),
          estimatedLossAmount: claim.estimatedLossAmount,
          finalLossAmount: claim.finalLossAmount ?? '',
          occurrenceDate: claim.occurrenceDate.split('T')[0],
          reportedDate: claim.reportedDate.split('T')[0],
          claimCause: claim.claimCause,
          occurrenceDetails: claim.occurrenceDetails ?? '',
          currency: claim.currency,
        });
      } else {
        reset({
          ...MAKE_CLAIM_DEFAULTS,
          currency: effectivePlacement?.currency ?? '',
          claimTag: mode === 'actual' ? 'finalized' : 'pending',
        });
      }
    } else {
      reset(MAKE_CLAIM_DEFAULTS);
      if (showPicker) {
        setCedantId('');
        setBusinessId('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, claim, reset]);

  const handleClose = () => {
    reset(MAKE_CLAIM_DEFAULTS);
    onClose();
  };

  const onSubmit = async (values: MakeClaimFormValues) => {
    if (!effectivePlacement) return;

    const isActualCreate = formMode === 'actual' && !isEditing;
    const amount = isActualCreate ? values.finalLossAmount : values.estimatedLossAmount;

    const businessCurrency = effectivePlacement.currency ?? values.currency;
    const needsConversion = values.currency !== businessCurrency;
    const rate = needsConversion ? parseFloat(values.rate) || 1 : 1;
    const convert = (raw: string) => {
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) return parsed;
      return needsConversion ? Math.round(parsed * rate * 100) / 100 : parsed;
    };

    const nextState = claimTagToState(values.claimTag);

    try {
      if (isEditing && claim) {
        // Send only the fields the user actually changed. The back-end rejects an
        // edit that carries occurrenceDate / currency / estimatedLossAmount /
        // finalLossAmount while the claim is finalized, even when unchanged — and
        // the claimState transition is what generates or voids allocations.
        const currentState: ClaimState =
          claim.claimState ?? (claim.finalLossAmount != null ? 'FINALIZED' : 'PENDING');
        const nextFinalLoss = values.finalLossAmount ? convert(values.finalLossAmount) : undefined;
        const currentFinalLoss =
          claim.finalLossAmount != null ? Number(claim.finalLossAmount) : undefined;

        const changes: UpdatePlacementClaimPayload = {};
        if (values.claimNumber !== claim.claimNumber) {
          changes.claimNumber = values.claimNumber;
        }
        if (values.claimCause !== claim.claimCause) {
          changes.claimCause = values.claimCause;
        }
        if (values.occurrenceDetails !== (claim.occurrenceDetails ?? '')) {
          changes.occurrenceDetails = values.occurrenceDetails;
        }
        if (values.reportedDate && values.reportedDate !== claim.reportedDate.split('T')[0]) {
          changes.reportedDate = new Date(values.reportedDate).toISOString();
        }
        if (values.occurrenceDate !== claim.occurrenceDate.split('T')[0]) {
          changes.occurrenceDate = new Date(values.occurrenceDate).toISOString();
        }
        if (businessCurrency !== claim.currency) {
          changes.currency = businessCurrency;
        }
        if (convert(values.estimatedLossAmount) !== Number(claim.estimatedLossAmount)) {
          changes.estimatedLossAmount = convert(values.estimatedLossAmount);
        }
        if (nextFinalLoss !== undefined && nextFinalLoss !== currentFinalLoss) {
          changes.finalLossAmount = nextFinalLoss;
        }
        if (nextState !== currentState) {
          changes.claimState = nextState;
        }

        const updatedClaim = Object.keys(changes).length
          ? await updateClaim.mutateAsync(changes)
          : claim;
        onSuccess?.(updatedClaim);

        if (changes.claimState === 'FINALIZED') {
          setSuccessModal({
            title: 'Claim Finalized',
            message: 'Reinsurer allocations have been finalized for this claim.',
          });
        } else if (changes.claimState === 'PENDING') {
          setSuccessModal({
            title: 'Claim Moved to Pending',
            message: 'The finalized allocations have been voided.',
          });
        } else {
          addToast({ message: 'Claim updated successfully', type: 'success' });
        }
        handleClose();
        return;
      }

      const newClaim = await createClaim.mutateAsync({
        placementId: effectivePlacement.id,
        claimNumber: values.claimNumber,
        occurrenceDate: new Date(values.occurrenceDate).toISOString(),
        reportedDate: new Date().toISOString(),
        claimCause: values.claimCause,
        occurrenceDetails: values.occurrenceDetails || undefined,
        currency: businessCurrency,
        estimatedLossAmount: convert(amount),
        finalLossAmount: isActualCreate ? convert(amount) : undefined,
        claimState: formMode === 'actual' ? nextState : undefined,
      });
      onSuccess?.(newClaim);

      if (formMode === 'actual') {
        setSuccessModal({
          title: 'Claim Created',
          message:
            nextState === 'FINALIZED'
              ? 'The open claim has been created and reinsurer allocations have been finalized.'
              : 'The open claim has been created.',
        });
      } else {
        addToast({ message: 'Claim submitted successfully', type: 'success' });
      }
      handleClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  return (
    <>
      <SuccessModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title ?? ''}
        message={successModal?.message}
      />
      <SidePanel
        isOpen={isOpen}
        onClose={handleClose}
        title={isEditing ? 'Edit Claim' : mode === 'actual' ? 'Add Claim' : 'Add Notification'}
        description={
          effectivePlacement
            ? `Claim for ${displayPolicyNumber(effectivePlacement.policyNumber)}`
            : 'Submit a claim'
        }
        footer={
          effectivePlacement ? (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                isLoading={isSubmitting}
                loadingText={isEditing ? 'Updating…' : 'Submitting…'}
                onClick={handleSubmit(onSubmit)}
              >
                {isEditing ? 'Update Claim' : mode === 'actual' ? 'Add Claim' : 'Submit Claim'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {showPicker && (
          <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
            <SearchSelect
              label="Cedant"
              placeholder="Select cedant…"
              options={cedantOptions}
              value={cedantId}
              onChange={(val) => {
                setCedantId(val);
                setBusinessId('');
                setBusinessQuery('');
                onPlacementChange?.('');
                onPlacementResolved?.(null);
              }}
            />
            {cedantId && (
              <SearchSelect
                label="Business"
                placeholder="Select business…"
                options={businessOptions}
                value={businessId}
                onChange={(val) => {
                  setBusinessId(val);
                  onPlacementChange?.(val);
                }}
                onQueryChange={setBusinessQuery}
              />
            )}
            {effectivePlacement && <hr className="border-gray-100" />}
          </div>
        )}

        {effectivePlacement && (
          <MakeClaimFormFields
            form={form}
            placement={effectivePlacement}
            hidePlacementInfo={showPicker}
            isEditing={isEditing}
            mode={formMode}
          />
        )}
      </SidePanel>
    </>
  );
}
