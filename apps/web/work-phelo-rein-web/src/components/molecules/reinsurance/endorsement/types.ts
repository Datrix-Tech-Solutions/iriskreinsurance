import { EndorsementParticipantClosing } from '@/types/reinsurance';

export interface EndorsementParticipantRow {
  id: string;
  participantId?: string;
  originalParticipantId?: string | null;
  counterpartyId: string;
  reinsurerName: string;
  originalShare: number;
  offeredShare: number;
  brokerageFee: number;
  isNew: boolean;
}

export interface EndorsementMarketPreviewState {
  counterpartyId: string;
  documentTitle: string;
  recipientName: string;
  relationship: string;
  offeredLinePercent: number;
  status: string;
  brokerageFee: number;
  previewFormat: 'OFFER_SLIP' | 'REVISED_CERTIFICATE';
  /** When set, this is the confirmed, closed-endorsement figures for this participant —
   *  renders as an "Endorsement Certificate" using authoritative closing data instead of
   *  the live pre-close "Endorsement Offer Slip" estimate. */
  confirmedClosing?: EndorsementParticipantClosing;
}
