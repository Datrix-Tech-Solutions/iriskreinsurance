'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { usePlacementPayments, useReversePayment } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { cn } from '@/lib/utils';
import {
  canReversePayment,
  isActiveReinsurerDisbursement,
  paymentReversalRequest,
} from '@/components/molecules/reinsurance/tabs/paymentHistoryActions';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: string, currency: string): string {
  const n = parseFloat(val);
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface ReversePremiumModalProps {
  isOpen: boolean;
  placementId: string | null;
  onClose: () => void;
}

/**
 * Reverses a cedant premium payment straight from the payments worklist. Only offered while no
 * reinsurer disbursement has been made against the premium; when the placement carries more than
 * one confirmed premium payment the user picks which one to reverse.
 */
export function ReversePremiumModal({ isOpen, placementId, onClose }: ReversePremiumModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const { data: payments = [], isLoading } = usePlacementPayments(placementId ?? '', {
    enabled: isOpen && !!placementId,
  });
  const reversePayment = useReversePayment();
  // Null until the user picks; a stale pick from a previous placement is discarded by the
  // `reversiblePremiums.find` check below rather than reset in an effect.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const reversiblePremiums = useMemo(
    () =>
      payments
        .filter(
          (p) => p.type === 'PREMIUM_RECEIVED' && !p.reversalOfPaymentId && canReversePayment(p),
        )
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
    [payments],
  );

  const blockedByDisbursement = useMemo(
    () => payments.some(isActiveReinsurerDisbursement),
    [payments],
  );

  const soleCandidateId = reversiblePremiums.length === 1 ? reversiblePremiums[0].id : null;
  // Fall back to the sole candidate (or nothing) whenever the current pick isn't among the
  // placement's reversible premiums — e.g. right after the modal is reopened for another row.
  const selectedId = reversiblePremiums.find((p) => p.id === pickedId)?.id ?? soleCandidateId;

  const handleReverse = async () => {
    if (!placementId || !selectedId) return;
    const target = reversiblePremiums.find((p) => p.id === selectedId);
    if (!target) return;
    try {
      await reversePayment.mutateAsync(paymentReversalRequest(placementId, target));
      addToast({ message: 'Premium payment reversed successfully', type: 'success' });
      onClose();
    } catch (error) {
      addToast({ message: extractError(error), type: 'error' });
    }
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (isLoading) {
    body = <p className="mt-2 text-sm text-gray-500">Loading premium payments…</p>;
  } else if (blockedByDisbursement) {
    body = (
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        A reinsurer disbursement has already been made against this premium. Reverse the
        disbursements before reversing the premium.
      </p>
    );
    footer = (
      <Button variant="outline" onClick={onClose}>
        Got it
      </Button>
    );
  } else if (reversiblePremiums.length === 0) {
    body = (
      <p className="mt-2 text-sm text-gray-500">
        There is no confirmed premium payment available to reverse for this placement.
      </p>
    );
    footer = (
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    );
  } else {
    body = (
      <div className="mt-3 flex flex-col gap-3">
        {reversiblePremiums.length > 1 && (
          <p className="text-sm text-gray-500">
            This placement has more than one premium payment. Pick the one to reverse.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {reversiblePremiums.map((p) => {
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPickedId(p.id)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {fmtAmount(p.amount, p.currency)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {fmtDate(p.paymentDate)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'h-4 w-4 shrink-0 rounded-full border-2',
                    active ? 'border-brand bg-brand' : 'border-gray-300',
                  )}
                />
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-gray-400">
          Reverse the recent cedant&apos;s premium payment and refund the cedant.
        </p>
        <p className="text-xs leading-relaxed text-gray-400"></p>
      </div>
    );
    footer = (
      <>
        <Button variant="outline" onClick={onClose} disabled={reversePayment.isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleReverse}
          disabled={!selectedId}
          isLoading={reversePayment.isPending}
          loadingText="Reversing…"
        >
          Reverse Premium
        </Button>
      </>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reverse Premium Payment" footer={footer}>
      {body}
    </Modal>
  );
}
