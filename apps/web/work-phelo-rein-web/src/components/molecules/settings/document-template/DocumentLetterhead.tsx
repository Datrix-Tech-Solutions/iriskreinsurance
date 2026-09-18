'use client';

/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from 'react';
import QRCode from 'react-qr-code';
import {
  SLOT_ALIGN,
  SLOT_ORDER,
  splitLines,
  type DocumentTemplate,
  type SlotPosition,
} from './templateConfig';

/** The document header: logo, company name and QR code dropped into the
 *  start / middle / end slots the template assigns them. */
export function DocumentLetterhead({ template }: { template: DocumentTemplate }) {
  // Logo is bounded to a fixed footprint — a little taller than the QR code
  // (3.8em) — so every document renders the logo at the same size.
  const logoEl = template.logo ? (
    <img src={template.logo} alt="" className="max-h-[4.4em] w-auto max-w-[9em] object-contain" />
  ) : (
    <div className="flex h-[4.4em] w-[9em] items-center justify-center rounded border border-dashed border-gray-300 text-[0.72em] font-medium text-gray-400">
      LOGO
    </div>
  );

  const companyEl = (
    <div className="min-w-0">
      <p className="text-[1.05em] font-bold text-gray-900">
        {template.companyName || 'Company Name'}
      </p>
      {splitLines(template.identityLines).map((line, i) => (
        <p key={i} className="text-[0.72em] leading-tight text-gray-500">
          {line}
        </p>
      ))}
    </div>
  );

  const qrEl = (
    <div className="rounded bg-white p-1">
      <QRCode
        value={template.qrValue || 'https://example.com'}
        size={96}
        style={{ width: '3.8em', height: '3.8em' }}
      />
    </div>
  );

  const slots: Record<SlotPosition, ReactNode[]> = { start: [], middle: [], end: [] };
  if (template.showLogo) slots[template.logoPosition].push(<div key="logo">{logoEl}</div>);
  if (template.showCompanyName) {
    slots[template.companyNamePosition].push(<div key="company">{companyEl}</div>);
  }
  if (template.showQr) slots[template.qrPosition].push(<div key="qr">{qrEl}</div>);

  return (
    <div
      className="grid grid-cols-3 items-start gap-2 border-b pb-[1.4em]"
      style={{ borderColor: '#e5e7eb' }}
    >
      {SLOT_ORDER.map((slot) => (
        <div key={slot} className={`flex min-w-0 flex-col gap-[0.5em] ${SLOT_ALIGN[slot]}`}>
          {slots[slot]}
        </div>
      ))}
    </div>
  );
}
