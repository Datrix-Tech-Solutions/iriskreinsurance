'use client';

/* eslint-disable @next/next/no-img-element */

import { SAMPLE_DOCUMENTS, type DocumentTemplate } from './templateConfig';

function SignatureBlock({ template }: { template: DocumentTemplate }) {
  const alignEnd = template.signaturePosition === 'right';
  return (
    <div
      className={`mt-[1.6em] flex flex-col ${
        alignEnd ? 'items-end text-right' : 'items-start text-left'
      }`}
    >
      {template.signatureImage ? (
        <img
          src={template.signatureImage}
          alt=""
          className="h-[4em] w-auto max-w-[14em] object-contain"
        />
      ) : (
        <div className="h-[3.4em] w-[14em] border-b border-gray-400" />
      )}
      <p className="mt-[0.4em] text-[0.82em] font-semibold text-gray-800">
        {template.signatoryName || 'Authorized Signatory'}
      </p>
      <p className="text-[0.72em] text-gray-500">{template.signatoryTitle || 'Title'}</p>
    </div>
  );
}

/** The document content area — sample data for the chosen document type, plus
 *  the signature block when this document type requires one. */
export function DocumentBody({ template }: { template: DocumentTemplate }) {
  const sample = SAMPLE_DOCUMENTS[template.previewDoc];
  const showSignature = template.signatureEnabled && template.signatureRules[template.previewDoc];

  return (
    <div className="flex-1 overflow-hidden pt-[1.4em]">
      <h3
        className="mb-[0.6em] inline-block pb-[0.3em] text-[1.2em] font-bold uppercase tracking-wide text-gray-900"
        style={{ borderBottom: `2px solid ${template.accent}` }}
      >
        {sample.title}
      </h3>
      <p className="mb-[0.8em] text-[0.75em] text-gray-500">
        Date: 12 Feb 2026 · Ref: {sample.ref}
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {sample.rows.map(([key, value], i) => (
            <tr key={i} style={i === sample.rows.length - 1 ? { fontWeight: 600 } : undefined}>
              <td className="border-b border-gray-100 py-[0.35em] pr-2 text-[0.82em] text-gray-500">
                {key}
              </td>
              <td className="border-b border-gray-100 py-[0.35em] text-right text-[0.82em] text-gray-800">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showSignature && <SignatureBlock template={template} />}
    </div>
  );
}
