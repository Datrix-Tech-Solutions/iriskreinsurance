'use client';

import type { DocumentTemplate } from './templateConfig';

/** The document footer: location / address / tel lines, with an optional page number. */
export function DocumentFooter({ template }: { template: DocumentTemplate }) {
  const footerLines = [
    template.footerLocation.trim() && `Location: ${template.footerLocation.trim()}`,
    template.footerAddress.trim() && `Address: ${template.footerAddress.trim()}`,
    template.footerTel.trim() && `Tel: ${template.footerTel.trim()}`,
  ].filter((line): line is string => Boolean(line));

  return (
    <div
      className="mt-auto flex items-end justify-between gap-3 border-t pt-[1em]"
      style={{ borderColor: '#e5e7eb' }}
    >
      <div className="space-y-[0.2em]">
        {footerLines.map((line, i) => (
          <p key={i} className="text-[0.68em] leading-tight text-gray-400">
            {line}
          </p>
        ))}
      </div>
      {template.showPageNumbers && (
        <p className="shrink-0 text-[0.68em] text-gray-400">Page 1 of 1</p>
      )}
    </div>
  );
}
