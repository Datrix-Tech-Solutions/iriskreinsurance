'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { inputClass } from '@/lib/utils';

const AGREEMENT_TYPE_LABELS: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Other',
};

interface Agreement {
  id: string;
  type: string;
  title: string;
  details: string;
}

interface ViewModeProps {
  mode: 'view';
  onClose: () => void;
}

interface EmployeeModeProps {
  mode: 'employee';
  onAccept: (comment: string) => void;
  onReject: (comment: string) => void;
  isSubmitting?: boolean;
}

type AgreementViewModalProps = {
  isOpen: boolean;
  agreement: Agreement | null;
} & (ViewModeProps | EmployeeModeProps);

export function AgreementViewModal(props: AgreementViewModalProps) {
  const { isOpen, agreement, mode } = props;
  const [comment, setComment] = useState('');

  const typeLabel = agreement ? (AGREEMENT_TYPE_LABELS[agreement.type] ?? agreement.type) : '';

  const handleClose = () => {
    setComment('');
    if (mode === 'view') props.onClose();
  };

  const handleAccept = () => {
    if (mode === 'employee') {
      props.onAccept(comment);
      setComment('');
    }
  };

  const handleReject = () => {
    if (mode === 'employee') {
      props.onReject(comment);
      setComment('');
    }
  };

  const footer =
    mode === 'view' ? (
      <Button onClick={handleClose}>OK</Button>
    ) : (
      <div className="flex items-center gap-3 w-full">
        <Button
          variant="danger"
          onClick={handleReject}
          disabled={(props as EmployeeModeProps).isSubmitting}
        >
          Reject
        </Button>
        <Button
          onClick={handleAccept}
          disabled={(props as EmployeeModeProps).isSubmitting}
          isLoading={(props as EmployeeModeProps).isSubmitting}
          loadingText="Submitting…"
        >
          Accept
        </Button>
      </div>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={typeLabel}
      width="w-full sm:w-[90vw] md:w-[70vw] lg:w-[50vw] min-h-[70vh]"
      hideClose={mode === 'employee'}
      footer={footer}
    >
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
            Title
          </p>
          <p className="text-base font-semibold text-gray-900">{agreement?.title}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Details
          </p>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[calc(70vh-220px)] overflow-y-auto rounded-lg border border-gray-100 p-4">
            {agreement?.details}
          </div>
        </div>

        {mode === 'employee' && (
          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <label className="text-sm font-bold text-gray-900">Agree</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Type your agreement…"
              className={inputClass()}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
