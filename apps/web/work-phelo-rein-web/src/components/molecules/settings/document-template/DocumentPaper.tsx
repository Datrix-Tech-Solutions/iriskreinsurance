'use client';

import { DocumentWatermark } from './DocumentWatermark';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentBody } from './DocumentBody';
import { DocumentFooter } from './DocumentFooter';
import type { DocumentTemplate } from './templateConfig';

/** The A4/Letter sheet: watermark layer plus letterhead → content → footer.
 *  Text scales with the sheet width via a container query. */
export function DocumentPaper({ template }: { template: DocumentTemplate }) {
  const ratio = template.paper === 'a4' ? '1 / 1.4142' : '1 / 1.2941';
  const padding =
    template.margin === 'compact' ? 'clamp(12px, 4%, 22px)' : 'clamp(16px, 6.5%, 40px)';
  const fontFamily =
    template.font === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : 'var(--font-app), system-ui, sans-serif';

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="relative w-full @container" style={{ aspectRatio: ratio }}>
        <DocumentWatermark template={template} />
        <div
          className="relative z-10 flex h-full flex-col"
          style={{
            padding,
            fontFamily,
            color: '#111827',
            fontSize: 'clamp(9px, 2.7cqw, 22px)',
          }}
        >
          <DocumentLetterhead template={template} />
          <DocumentBody template={template} />
          <DocumentFooter template={template} />
        </div>
      </div>
    </div>
  );
}
