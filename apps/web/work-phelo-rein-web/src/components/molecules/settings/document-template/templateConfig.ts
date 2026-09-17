export type PreviewDoc =
  | 'debit-note'
  | 'offer-slip'
  | 'payment-receipt'
  | 'endorsement-certificate'
  | 'credit-note';

export type WatermarkMode = 'none' | 'text' | 'image';
export type SlotPosition = 'start' | 'middle' | 'end';
export type SignaturePosition = 'left' | 'right';

//water mark opacity
export const WATERMARK_OPACITY = 0.2;
// for text water mark sits at a -30 degree angle and for the image there would be no angle so it would sit upright
export const WATERMARK_TEXT_ANGLE = -30;
export const WATERMARK_IMAGE_ANGLE = 0;

export interface DocumentTemplate {
  previewDoc: PreviewDoc;
  // Letterhead
  logo: string | null;
  showLogo: boolean;
  logoPosition: SlotPosition;
  companyName: string;
  identityLines: string;
  showCompanyName: boolean;
  companyNamePosition: SlotPosition;
  showQr: boolean;
  qrValue: string;
  qrPosition: SlotPosition;
  // Body
  accent: string;
  font: 'sans' | 'serif';
  paper: 'a4' | 'letter';
  margin: 'comfortable' | 'compact';
  // Footer
  footerLocation: string;
  footerAddress: string;
  footerTel: string;
  showPageNumbers: boolean;
  // Watermark
  watermarkMode: WatermarkMode;
  watermarkText: string;
  watermarkImage: string | null;
  watermarkTiled: boolean;
  // Signature
  signatureEnabled: boolean;
  signaturePosition: SignaturePosition;
  signatureImage: string | null;
  signatoryName: string;
  signatoryTitle: string;
  signatureRules: Record<PreviewDoc, boolean>;
}

export const DEFAULT_TEMPLATE: DocumentTemplate = {
  previewDoc: 'debit-note',
  logo: null,
  showLogo: true,
  logoPosition: 'start',
  companyName: 'Your Company Ltd',
  identityLines: 'Reg. No. RC-000000\nP. O. Box 0000, Accra\n+233 00 000 0000',
  showCompanyName: true,
  companyNamePosition: 'middle',
  showQr: true,
  qrValue: 'https://www.workphelo.com',
  qrPosition: 'end',
  accent: '#1e3a8a',
  font: 'sans',
  paper: 'a4',
  margin: 'comfortable',
  footerLocation: 'No. D17 Boundary Road, East Legon, Accra',
  footerAddress: 'P. O. Box MD2671, Madina - Accra',
  footerTel: '+233 (501) 605 643 / +233 (246) 923 436',
  showPageNumbers: true,
  watermarkMode: 'text',
  watermarkText: 'DRAFT',
  watermarkImage: null,
  watermarkTiled: false,
  signatureEnabled: true,
  signaturePosition: 'left',
  signatureImage: null,
  signatoryName: 'Ama Mensah',
  signatoryTitle: 'Head of Reinsurance',
  signatureRules: {
    'debit-note': false,
    'offer-slip': true,
    'payment-receipt': false,
    'endorsement-certificate': true,
    'credit-note': false,
  },
};

export interface SampleDocument {
  title: string;
  ref: string;
  rows: [string, string][];
}

export const SAMPLE_DOCUMENTS: Record<PreviewDoc, SampleDocument> = {
  'debit-note': {
    title: 'Debit Note',
    ref: 'DN-2026-0042',
    rows: [
      ['Reinsured', 'ABC Insurance Ltd'],
      ['Policy number', 'FAC/2026/0042'],
      ['Class', 'Fire & Allied Perils'],
      ['Period', '01 Jan 2026 – 31 Dec 2026'],
      ['Currency', 'GHS'],
      ['100% gross premium', '1,200,000.00'],
      ['25% facultative share', '300,000.00'],
      ['Less commission 22.5%', '67,500.00'],
      ['Net premium due', '232,500.00'],
    ],
  },
  'offer-slip': {
    title: 'Reinsurance Offer Slip',
    ref: 'OS-2026-0042',
    rows: [
      ['Insured', 'ABC Manufacturing Plc'],
      ['Class', 'Engineering – CAR'],
      ['Total sum insured', 'GHS 8,000,000.00'],
      ['Period', '01 Mar 2026 – 28 Feb 2027'],
      ['Offered share', '15%'],
      ['Premium at 100%', 'GHS 640,000.00'],
      ['Your premium', 'GHS 96,000.00'],
    ],
  },
  'payment-receipt': {
    title: 'Payment Receipt',
    ref: 'PR-2026-0117',
    rows: [
      ['Received from', 'ABC Insurance Ltd'],
      ['In respect of', 'FAC/2026/0042 – Net premium'],
      ['Amount', 'GHS 232,500.00'],
      ['Method', 'Bank transfer'],
      ['Value date', '14 Feb 2026'],
      ['Reference', 'TRX-88213'],
    ],
  },
  'endorsement-certificate': {
    title: 'Endorsement Certificate',
    ref: 'END/2026/0007',
    rows: [
      ['Endorsement no.', 'END/2026/0007'],
      ['Effective date', '01 Jun 2026'],
      ['Nature of change', 'Increase in sum insured'],
      ['Revised sum insured', 'GHS 9,500,000.00'],
      ['Revised share', '15%'],
      ['Additional premium', 'GHS 18,000.00'],
    ],
  },
  'credit-note': {
    title: 'Credit Note',
    ref: 'CN-2026-0042',
    rows: [
      ['Reinsurer', 'Continental Re'],
      ['Policy number', 'FAC/2026/0042'],
      ['Gross share premium', '300,000.00'],
      ['Less commission 22.5%', '67,500.00'],
      ['Net amount', '232,500.00'],
    ],
  },
};

export const PREVIEW_DOC_OPTIONS: { value: PreviewDoc; label: string }[] = (
  Object.keys(SAMPLE_DOCUMENTS) as PreviewDoc[]
).map((value) => ({ value, label: SAMPLE_DOCUMENTS[value].title }));

export const SIGNATURE_POSITION_OPTIONS: { value: SignaturePosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export const SLOT_ORDER: SlotPosition[] = ['start', 'middle', 'end'];

export const SLOT_ALIGN: Record<SlotPosition, string> = {
  start: 'items-start text-left',
  middle: 'items-center text-center',
  end: 'items-end text-right',
};

export const POSITION_OPTIONS: { value: SlotPosition; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'middle', label: 'Middle' },
  { value: 'end', label: 'End' },
];

/** Split a multi-line string into trimmed, non-empty lines. */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
