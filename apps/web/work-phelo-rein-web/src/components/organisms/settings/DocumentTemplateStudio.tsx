'use client';

import { useState } from 'react';
import {
  DEFAULT_TEMPLATE,
  type DocumentTemplate,
} from '@/components/molecules/settings/document-template/templateConfig';
import { LetterheadSection } from '@/components/molecules/settings/document-template/LetterheadSection';
import { WatermarkSection } from '@/components/molecules/settings/document-template/WatermarkSection';
import { SignatureSection } from '@/components/molecules/settings/document-template/SignatureSection';
import { FooterSection } from '@/components/molecules/settings/document-template/FooterSection';
import { DocumentPaper } from '@/components/molecules/settings/document-template/DocumentPaper';

/**
 * Document template studio — collapsible form sections on the left, a live A4
 * preview on the right. State is local; nothing is persisted yet.
 */
export function DocumentTemplateStudio() {
  const [template, setTemplate] = useState<DocumentTemplate>(DEFAULT_TEMPLATE);

  const update = <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) =>
    setTemplate((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4">
        <LetterheadSection template={template} onChange={update} />
        <WatermarkSection template={template} onChange={update} />
        <SignatureSection template={template} onChange={update} />
        <FooterSection template={template} onChange={update} />
      </div>

      <div className="lg:sticky lg:top-2 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Live preview</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            Not saved
          </span>
        </div>
        <DocumentPaper template={template} />
      </div>
    </div>
  );
}
