'use client';

import { DebitNotePreviewModal } from '@/components/organisms/reinsurance/documents/DebitNotePreviewModal';
import { ClosingsPreviewModal } from '@/components/organisms/reinsurance/documents/ClosingsPreviewModal';
import { Facultative, PlacementDocument, PlacementNote } from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

type UnknownRecord = Record<string, unknown>;

interface NoteDocumentModalProps {
  isOpen: boolean;
  document: PlacementDocument | null;
  note?: PlacementNote | null;
  placement?: Facultative;
  onClose: () => void;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function noteKind(type: unknown): 'CREDIT' | 'DEBIT' {
  return type === 'CREDIT_NOTE' || type === 'ENDORSEMENT_CREDIT_NOTE' ? 'CREDIT' : 'DEBIT';
}

/** Display name + default bank accounts carried in a document's render payload. */
function profileFromPayload(payload: UnknownRecord) {
  const identity = record(record(payload.documentProfile).identity);
  const banking = record(record(payload.documentProfile).banking);
  return {
    displayName: text(identity.displayName || identity.legalName),
    bankAccounts: Array.isArray(banking.defaultAccounts) ? banking.defaultAccounts.map(record) : [],
  };
}

/**
 * Routes a persisted note / document to the matching content-only preview —
 * "Closings" (credit) or "Debit Note".
 */
export function NoteDocumentModal({
  isOpen,
  document,
  note: noteRecord,
  placement,
  onClose,
}: NoteDocumentModalProps) {
  if (!document && !noteRecord) return null;

  const payload = document ? record(document.renderPayload) : {};
  const note: UnknownRecord = document ? record(payload.note) : record(noteRecord);
  const profile = profileFromPayload(payload);
  const kind = noteKind(note.type);
  const counterparty = record(note.counterparty);
  const counterpartyName = text(counterparty.name || placement?.cedant?.name);
  const policyNumberDisplay = displayPolicyNumber(placement?.policyNumber ?? null);

  if (kind === 'CREDIT') {
    return (
      <ClosingsPreviewModal
        isOpen={isOpen}
        title={`Closings — ${policyNumberDisplay}`}
        onClose={onClose}
        note={note}
        placement={placement}
        reinsurerCompany={counterpartyName}
      />
    );
  }

  return (
    <DebitNotePreviewModal
      isOpen={isOpen}
      title={`Debit Note — ${policyNumberDisplay}`}
      onClose={onClose}
      note={note}
      placement={placement}
      cedantName={text(placement?.cedant?.name || counterparty.name)}
      companyName={profile.displayName !== '—' ? profile.displayName : null}
      bankAccounts={profile.bankAccounts}
    />
  );
}
