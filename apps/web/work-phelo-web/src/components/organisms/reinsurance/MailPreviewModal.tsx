'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { CreatableSearchSelect } from '@/components/atoms/CreatableSearchSelect';
import { RichTextEditor } from '@/components/molecules/shared/RichTextEditor';
import { Icons } from '@/components/atoms/icons';
import { inputClass } from '@/lib/utils';
import { Facultative, PlacementClaim, PlacementClaimAllocation } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  useUpdateClaimStatus,
  useCreateClaimCashCall,
  useUpdateClaimCashCallStatus,
  useApproveClaimRecovery,
} from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

interface MailPreviewModalProps {
  isOpen: boolean;
  placement: Facultative;
  brokerageFee: number;
  recipients: string[];
  onSend: () => void;
  onClose: () => void;
  onClosePlacement?: () => void;
  claim?: PlacementClaim;
  allocation?: PlacementClaimAllocation;
}

export function MailPreviewModal({
  isOpen,
  placement,
  recipients,
  onSend,
  onClose,
  claim,
  allocation,
}: MailPreviewModalProps) {
  const [localRecipients, setLocalRecipients] = useState<string[]>(recipients);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  const updateClaimStatus = useUpdateClaimStatus(placement.id, claim?.id ?? '');
  const createCashCall = useCreateClaimCashCall(placement.id, claim?.id ?? '');
  const updateCashCallStatus = useUpdateClaimCashCallStatus(placement.id, claim?.id ?? '');
  const approveRecovery = useApproveClaimRecovery(placement.id, claim?.id ?? '');
  const addToast = useToastStore((s) => s.addToast);

  const removeRecipient = (email: string) =>
    setLocalRecipients((prev) => prev.filter((e) => e !== email));

  const commitRecipient = (email: string) => {
    const trimmed = email.trim();
    if (trimmed && !localRecipients.includes(trimmed)) {
      setLocalRecipients((prev) => [...prev, trimmed]);
    }
    setRecipientDraft('');
    setAddingRecipient(false);
  };

  const handleClose = () => {
    setLocalRecipients([]);
    setAddingRecipient(false);
    setRecipientDraft('');
    setSubject('');
    setBody('');
    setAttachment(null);
    onClose();
  };

  const handleSend = async () => {
    if (claim) {
      setIsSending(true);
      try {
        await updateClaimStatus.mutateAsync('NOTIFIED');
        if (allocation) {
          const cashCall = await createCashCall.mutateAsync(allocation.id);
          await updateCashCallStatus.mutateAsync({ cashCallId: cashCall.id, status: 'ISSUED' });
          // Recognizes the receivable for the full demanded amount at send time, so a recovery
          // approval always exists once a cash call is issued — recording a receipt against it
          // later (Cash Calls tab) no longer needs a separate approval step of its own.
          await approveRecovery.mutateAsync({
            allocationId: allocation.id,
            approvedAmount: parseFloat(cashCall.amount),
            cashCallId: cashCall.id,
          });
        }
      } catch (error) {
        addToast({ message: extractError(error), type: 'error' });
        setIsSending(false);
        return;
      }
      setIsSending(false);
    }
    setLocalRecipients([]);
    setSubject('');
    setBody('');
    setAttachment(null);
    onSend();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Mail — ${placement.cedant.name}`}
      width="sm:w-[50vw] sm:max-w-[60vw]"
      height="sm:h-[80vh] sm:max-h-[90vh]"
      fullScreenMobile
      footer={
        <div className="flex items-end justify-between gap-4 w-full">
          <FileUpload
            label=""
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            value={attachment}
            onChange={setAttachment}
          />
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} isLoading={isSending} loadingText="Sending…">
              Send
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        {/* Recipients */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Recipient(s)</label>

          <div
            className={inputClass(
              undefined,
              'bg-gray-50 flex flex-wrap items-center gap-1.5 min-h-10.5',
            )}
          >
            {localRecipients.map((email) => (
              <span key={email} className="inline-flex items-center gap-1 text-sm text-gray-700">
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Icons.X className="w-3 h-3" />
                </button>
                <span className="text-gray-400">,</span>
              </span>
            ))}
            {!addingRecipient && (
              <button
                type="button"
                onClick={() => setAddingRecipient(true)}
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
              >
                <Icons.Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>

          {addingRecipient && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CreatableSearchSelect
                  placeholder="Type or paste email…"
                  options={[]}
                  value={recipientDraft}
                  onChange={setRecipientDraft}
                />
              </div>
              <button
                type="button"
                onClick={() => commitRecipient(recipientDraft)}
                className="shrink-0 text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingRecipient(false);
                  setRecipientDraft('');
                }}
                className="shrink-0 text-gray-400 hover:text-gray-500 transition-colors"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Email Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Facultative Offer — ${displayPolicyNumber(placement.policyNumber)}`}
            className={inputClass()}
          />
        </div>

        {/* Body */}
        <RichTextEditor
          label="Body"
          value={body}
          onChange={setBody}
          placeholder="Write your message here…"
          minHeight={200}
          onFilesAdded={(files) => setAttachment(files[0])}
        />
      </div>
    </Modal>
  );
}
