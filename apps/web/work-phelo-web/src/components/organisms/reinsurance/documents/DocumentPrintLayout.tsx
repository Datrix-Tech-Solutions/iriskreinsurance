'use client';

/* eslint-disable @next/next/no-img-element */

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import {
  COMPANY_URL,
  FOOTER_LINES,
  LOGO_SRC,
  WATERMARK_SRC,
} from '@/lib/reinsurance/documentBranding';

const HEADER_H = 180; // px — must match the fixed header height
const FOOTER_H = 110; // px — must match the fixed footer height
const PAGE_GAP = 44; // px — breathing room below header on every printed page

/** The default sign-off block, used when no `afterContent` is passed. */
function DefaultSignOff() {
  return (
    <div
      style={{
        paddingTop: '24px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <p style={{ fontSize: '16px', color: '#374151', fontStyle: 'italic', margin: 0 }}>
        Kindly confirm your acceptance or otherwise
      </p>
      <div style={{ display: 'flex', gap: '50px' }}>
        {['Accepted by', 'Signature'].map((label) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>{label}</span>
            <div style={{ width: '224px', borderBottom: '1px solid #9ca3af', marginTop: '50px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DocumentPrintLayoutProps {
  documentTitle: string;
  children: ReactNode;
  /** Bottom-of-page sign-off. Omit for the default block; pass `null` for none. */
  afterContent?: ReactNode;
  /** Portal element id — the print pipeline looks this up. One per document type. */
  rootId?: string;
}

export function DocumentPrintLayout({
  children,
  afterContent,
  rootId = 'irisk-print-root',
}: DocumentPrintLayoutProps) {
  if (typeof document === 'undefined') return null;

  const signOff = afterContent === undefined ? <DefaultSignOff /> : afterContent;

  return createPortal(
    <div
      id={rootId}
      style={{ display: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Watermark */}
      <div
        data-print-watermark
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <img
          src={WATERMARK_SRC}
          alt=""
          style={{ width: '760px', height: '475px', objectFit: 'contain' }}
        />
      </div>

      {/* Fixed header — repeats on every page */}
      <div
        data-print-header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${HEADER_H}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '20px 56px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white',
          zIndex: 2,
        }}
      >
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <img
            src={LOGO_SRC}
            alt=""
            style={{ width: '260px', height: '130px', objectFit: 'contain' }}
          />
        </div>
        <QRCode value={COMPANY_URL} size={120} />
      </div>

      {/* Fixed footer — sticks to bottom of every page */}
      <div
        data-print-footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${FOOTER_H}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          borderTop: '1px solid #f3f4f6',
          backgroundColor: 'white',
          padding: '14px 56px',
          zIndex: 2,
          fontFamily: 'var(--font-app), sans-serif',
        }}
      >
        {FOOTER_LINES.map((line) => (
          <p
            key={line}
            style={{ fontSize: '18px', color: '#6b7280', margin: 0, textAlign: 'center' }}
          >
            {line}
          </p>
        ))}
      </div>

      {/*
        Table with transparent thead/tfoot spacers — these reserve exactly the
        same height as the fixed header/footer on every page, so content never
        flows behind them.
      */}
      <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative', zIndex: 1 }}>
        <thead>
          <tr>
            <td style={{ height: `${HEADER_H + PAGE_GAP}px`, padding: 0 }} />
          </tr>
        </thead>

        <tfoot>
          <tr>
            <td style={{ height: `${FOOTER_H}px`, padding: 0 }} />
          </tr>
        </tfoot>

        <tbody>
          <tr>
            <td style={{ padding: '0 48px', verticalAlign: 'top' }}>
              <div
                data-print-content
                style={{
                  maxWidth: '640px',
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: `calc(100vh - ${HEADER_H + PAGE_GAP + FOOTER_H}px)`,
                }}
              >
                <div>{children}</div>

                {signOff ? (
                  <div
                    data-print-block
                    style={{ marginTop: 'auto', paddingTop: '64px', paddingBottom: '40px' }}
                  >
                    {signOff}
                  </div>
                ) : null}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
