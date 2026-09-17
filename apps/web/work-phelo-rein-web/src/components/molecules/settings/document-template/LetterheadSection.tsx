'use client';

import type { ChangeEvent } from 'react';
import { Input } from '@/components/atoms/Input';
import { CollapsibleCard } from '@/components/atoms/CollapsibleCard';
import { ImageUploadField } from '@/components/atoms/ImageUploadField';
import { useToast } from '@/hooks/useToast';
import { LetterheadElementRow } from './LetterheadElementRow';
import type { DocumentTemplate } from './templateConfig';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

interface LetterheadSectionProps {
  template: DocumentTemplate;
  onChange: <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) => void;
}

export function LetterheadSection({ template, onChange }: LetterheadSectionProps) {
  const toast = useToast();

  return (
    <CollapsibleCard title="Letterhead">
      <div className="flex flex-col gap-3">
        <LetterheadElementRow
          label="Logo"
          show={template.showLogo}
          onShowChange={(value) => onChange('showLogo', value)}
          position={template.logoPosition}
          onPositionChange={(value) => onChange('logoPosition', value)}
        >
          <ImageUploadField
            hint="PNG, JPEG, WEBP or SVG · max 2 MB"
            value={template.logo}
            onChange={(dataUrl) => onChange('logo', dataUrl)}
            onClear={() => onChange('logo', null)}
            allowedTypes={LOGO_TYPES}
            maxBytes={LOGO_MAX_BYTES}
            onError={(message) => toast.error(message)}
          />
        </LetterheadElementRow>

        <LetterheadElementRow
          label="Company name"
          show={template.showCompanyName}
          onShowChange={(value) => onChange('showCompanyName', value)}
          position={template.companyNamePosition}
          onPositionChange={(value) => onChange('companyNamePosition', value)}
        >
          <Input
            label="Display name"
            value={template.companyName}
            onChange={(event) => onChange('companyName', event.target.value)}
          />
          <Input
            type="textarea"
            rows={3}
            label="Details (one per line)"
            placeholder={'Legal name\nReg. No. …\nAddress\nPhone · Email'}
            value={template.identityLines}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              onChange('identityLines', event.target.value)
            }
          />
        </LetterheadElementRow>

        <LetterheadElementRow
          label="QR code"
          show={template.showQr}
          onShowChange={(value) => onChange('showQr', value)}
          position={template.qrPosition}
          onPositionChange={(value) => onChange('qrPosition', value)}
        >
          <Input
            label="Company URL"
            placeholder="https://www.yourcompany.com"
            value={template.qrValue}
            onChange={(event) => onChange('qrValue', event.target.value)}
          />
        </LetterheadElementRow>
      </div>
    </CollapsibleCard>
  );
}
