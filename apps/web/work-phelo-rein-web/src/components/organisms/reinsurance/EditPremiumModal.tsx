'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { usePlacementPayments } from '@/hooks';
import { cn } from '@/lib/utils';
import { PlacementPayment } from '@/types/reinsurance';
import {
  canReversePayment,
  isActiveReinsurerDisbursement,
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

interface EditPremiumModalProps {
  isOpen: boolean;
  placementId: string | null;
  onClose: () => void;
  /** Called with the premium payment the user chose to edit. The actual edit happens in the
   *  Receive Cedant Premium side panel, pre-filled from this payment. */
  onSelect: (payment: PlacementPayment) => void;
}

/**
 * Picks which cedant premium payment to edit. Same eligibility as a plain reversal — only
 * premiums with no reinsurer disbursement against them qualify. With exactly one it hands off
 * immediately; with several it shows a chooser; the edit form itself is the shared side panel.
 */
export function EditPremiumModal({
  isOpen,
  placementId,
  onClose,
  onSelect,
}: EditPremiumModalProps) {
  const { data: payments = [], isLoading } = usePlacementPayments(placementId ?? '', {
    enabled: isOpen && !!placementId,
  });

  const editablePremiums = useMemo(
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

  const soleCandidate = editablePremiums.length === 1 ? editablePremiums[0] : null;

  // Hand a single candidate straight to the side panel — no chooser step. The ref keeps it to
  // one hand-off per open so a re-rendered onSelect prop can't fire it twice.
  const handedOffRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      handedOffRef.current = false;
      return;
    }
    if (!handedOffRef.current && !isLoading && !blockedByDisbursement && soleCandidate) {
      handedOffRef.current = true;
      onSelect(soleCandidate);
    }
  }, [isOpen, isLoading, blockedByDisbursement, soleCandidate, onSelect]);

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (isLoading || soleCandidate) {
    body = <p className="mt-2 text-sm text-gray-500">Loading premium payments…</p>;
  } else if (blockedByDisbursement) {
    body = (
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        A reinsurer disbursement has already been made against this premium. Reverse the
        disbursements from the placement&rsquo;s payment history before editing the premium.
      </p>
    );
    footer = (
      <Button variant="outline" onClick={onClose}>
        Got it
      </Button>
    );
  } else if (editablePremiums.length === 0) {
    body = (
      <p className="mt-2 text-sm text-gray-500">
        There is no confirmed premium payment available to edit for this placement.
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
        <p className="text-sm text-gray-500">
          This placement has more than one premium payment. Pick the one to edit.
        </p>
        <div className="flex flex-col gap-2">
          {editablePremiums.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                'border-gray-200 hover:border-gray-300',
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
              <span className="text-xs font-medium text-brand">Edit</span>
            </button>
          ))}
        </div>
      </div>
    );
    footer = (
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Premium Payment" footer={footer}>
      {body}
    </Modal>
  );
}
