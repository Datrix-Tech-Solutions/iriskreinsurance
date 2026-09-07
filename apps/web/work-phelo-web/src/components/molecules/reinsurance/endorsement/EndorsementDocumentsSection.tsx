'use client';

import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { PlacementNote } from '@/types/reinsurance';
import { fmtMoney } from './formatters';

interface EndorsementDocumentsSectionProps {
  notes: PlacementNote[];
  onViewNote: (note: PlacementNote) => void;
  onGenerateDebitNote: () => void;
  onIssueNote: (note: PlacementNote) => void;
  canGenerateDebitNote: boolean;
  isNoteBusy: boolean;
}

/** Cedant-facing endorsement debit notes list — renders nothing when there are none. */
export function EndorsementDocumentsSection({
  notes,
  onViewNote,
  onGenerateDebitNote,
  onIssueNote,
  canGenerateDebitNote,
  isNoteBusy,
}: EndorsementDocumentsSectionProps) {
  if (notes.length === 0 && !canGenerateDebitNote) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
      {notes.length === 0 && canGenerateDebitNote && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Post-closing financial document
            </p>
            <p className="text-sm text-amber-800">
              Generate the endorsement debit note from finalized closing details.
            </p>
          </div>
          <TableButton
            variant="blue"
            isLoading={isNoteBusy}
            onClick={() => {
              if (!isNoteBusy) onGenerateDebitNote();
            }}
          >
            Generate Debit Note
          </TableButton>
        </div>
      )}
      {notes.length > 0 && (
        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
          {notes.map((note) => (
            <div
              key={note.id}
              className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-5 lg:items-center"
            >
              <div>
                <p className="text-xs text-gray-400">Endorsement Debit Note</p>
                <p className="text-sm font-medium text-gray-900">{note.noteNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Type</p>
                <p className="text-sm text-gray-700">{note.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Net Amount</p>
                <p className="text-sm text-gray-700">{fmtMoney(note.netAmount, note.currency)}</p>
              </div>
              <div>
                <Badge
                  label={
                    note.status === 'ISSUED'
                      ? 'Issued'
                      : note.status === 'VOID'
                        ? 'VOID'
                        : 'Draft / Not Issued'
                  }
                  variant={
                    note.status === 'ISSUED'
                      ? 'success'
                      : note.status === 'VOID'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                {note.status === 'DRAFT' ? (
                  <TableButton
                    variant="blue"
                    isLoading={isNoteBusy}
                    onClick={() => {
                      if (!isNoteBusy) onIssueNote(note);
                    }}
                  >
                    Issue Debit Note
                  </TableButton>
                ) : (
                  <TableButton variant="gray" onClick={() => onViewNote(note)}>
                    View Endorsement Debit Note
                  </TableButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
