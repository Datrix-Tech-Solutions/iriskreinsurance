'use client';

import { useState } from 'react';
import { useMyCompanyAgreements, useSignMyAgreement, useDeclineMyAgreement } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { inputClass } from '@/lib/utils';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const AGREEMENT_TYPE_LABELS: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Agreement',
};

export function AgreementGate() {
  const { data: agreements, isLoading } = useMyCompanyAgreements();
  const { mutate: sign, isPending: isSigning } = useSignMyAgreement();
  const { mutate: decline, isPending: isDeclining } = useDeclineMyAgreement();

  const [typedName, setTypedName] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const pending = (agreements ?? []).filter(
    (a) => a.status === 'PENDING' && a.agreement.isRequired,
  );
  const current = pending[0] ?? null;

  if (isLoading || !current || dismissed) return null;

  const typeLabel = AGREEMENT_TYPE_LABELS[current.agreement.type] ?? 'Agreement';
  const total = pending.length;

  const handleAccept = () => {
    if (!typedName.trim()) {
      useToastStore
        .getState()
        .addToast({ message: 'Please type your full name to accept', type: 'error' });
      return;
    }
    sign(
      { versionId: current.version.id, typedName: typedName.trim() },
      {
        onSuccess: () => setTypedName(''),
        onError: (err) =>
          useToastStore
            .getState()
            .addToast({ message: extractError(err, 'Failed to sign agreement'), type: 'error' }),
      },
    );
  };

  const handleDeclineSubmit = () => {
    if (declineReason.trim().length < 3) {
      useToastStore
        .getState()
        .addToast({ message: 'Please provide a reason (at least 3 characters)', type: 'error' });
      return;
    }
    decline(
      { versionId: current.version.id, reason: declineReason.trim() },
      {
        onSuccess: () => {
          setDeclineOpen(false);
          setDeclineReason('');
          setDismissed(true);
        },
        onError: (err) =>
          useToastStore
            .getState()
            .addToast({ message: extractError(err, 'Failed to decline agreement'), type: 'error' }),
      },
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {typeLabel}
              </p>
              {total > 1 && (
                <span className="text-xs text-gray-400">
                  {total} agreement{total !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{current.version.title}</h1>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 max-h-[45vh] overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {current.version.details}
          </div>

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Type your full name to accept</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your full legal name"
              disabled={isSigning}
              className={inputClass()}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={() => setDeclineOpen(true)} disabled={isSigning}>
              Decline
            </Button>
            <Button variant="secondary" onClick={() => setDismissed(true)} disabled={isSigning}>
              Sign Later
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isSigning}
              isLoading={isSigning}
              loadingText="Signing…"
            >
              Accept
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            By accepting, you confirm that you have read and agree to be bound by this agreement.
          </p>
        </div>
      </div>

      <Modal
        isOpen={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline Agreement"
        description="Please provide a reason for declining this agreement."
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeclineSubmit}
              isLoading={isDeclining}
              loadingText="Submitting…"
            >
              Submit
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-(--field-label-gap,0.125rem) mt-4">
          <label className="text-sm font-bold text-gray-900">Reason</label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Enter your reason for declining…"
            rows={4}
            className={inputClass(undefined, 'resize-none')}
          />
        </div>
      </Modal>
    </>
  );
}
