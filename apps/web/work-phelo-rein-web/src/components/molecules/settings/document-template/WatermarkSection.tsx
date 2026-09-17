'use client';

import { Input } from '@/components/atoms/Input';
import { Toggle } from '@/components/atoms/Toggle';
import { SegmentedToggle } from '@/components/atoms/SegmentedToggle';
import { CollapsibleCard } from '@/components/atoms/CollapsibleCard';
import { ImageUploadField } from '@/components/atoms/ImageUploadField';
import { useToast } from '@/hooks/useToast';
import type { DocumentTemplate, WatermarkMode } from './templateConfig';

const MODE_OPTIONS: { value: WatermarkMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
];

const WATERMARK_MAX_BYTES = 2 * 1024 * 1024;
const WATERMARK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

interface WatermarkSectionProps {
  template: DocumentTemplate;
  onChange: <K extends keyof DocumentTemplate>(key: K, value: DocumentTemplate[K]) => void;
}

export function WatermarkSection({ template, onChange }: WatermarkSectionProps) {
  const toast = useToast();

  return (
    <CollapsibleCard title="Watermark">
      <div className="flex flex-col gap-3">
        <SegmentedToggle
          value={template.watermarkMode}
          onChange={(value) => onChange('watermarkMode', value)}
          options={MODE_OPTIONS}
        />

        {template.watermarkMode === 'text' && (
          <>
            <Input
              label="Text"
              placeholder="DRAFT"
              value={template.watermarkText}
              onChange={(event) => onChange('watermarkText', event.target.value)}
            />
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-sm font-bold text-gray-900">Repeat across page</span>
              <Toggle
                enabled={template.watermarkTiled}
                onChange={(value) => onChange('watermarkTiled', value)}
              />
            </div>
          </>
        )}

        {template.watermarkMode === 'image' && (
          <ImageUploadField
            hint="Transparent PNG works best · max 2 MB"
            value={template.watermarkImage}
            onChange={(dataUrl) => onChange('watermarkImage', dataUrl)}
            onClear={() => onChange('watermarkImage', null)}
            allowedTypes={WATERMARK_TYPES}
            maxBytes={WATERMARK_MAX_BYTES}
            onError={(message) => toast.error(message)}
          />
        )}
      </div>
    </CollapsibleCard>
  );
}
