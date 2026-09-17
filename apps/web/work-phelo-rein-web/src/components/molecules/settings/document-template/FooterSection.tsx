'use client';

import { Input } from '@/components/atoms/Input';
import { Toggle } from '@/components/atoms/Toggle';
import { CollapsibleCard } from '@/components/atoms/CollapsibleCard';
import type { DocumentTemplate } from './templateConfig';

interface FooterSectionProps {
  template: DocumentTemplate;
  onChange: <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) => void;
}

export function FooterSection({ template, onChange }: FooterSectionProps) {
  return (
    <CollapsibleCard title="Footer">
      <div className="flex flex-col gap-3">
        <Input
          label="Location"
          value={template.footerLocation}
          onChange={(event) => onChange('footerLocation', event.target.value)}
        />
        <Input
          label="Address"
          value={template.footerAddress}
          onChange={(event) => onChange('footerAddress', event.target.value)}
        />
        <Input
          label="Tel"
          value={template.footerTel}
          onChange={(event) => onChange('footerTel', event.target.value)}
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm font-bold text-gray-900">Show page numbers</span>
          <Toggle
            enabled={template.showPageNumbers}
            onChange={(value) => onChange('showPageNumbers', value)}
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
