'use client';

/* eslint-disable @next/next/no-img-element */

import {
  WATERMARK_IMAGE_ANGLE,
  WATERMARK_OPACITY,
  WATERMARK_TEXT_ANGLE,
  type DocumentTemplate,
} from './templateConfig';

/** Full-bleed watermark layer painted behind the document content. */
export function DocumentWatermark({ template }: { template: DocumentTemplate }) {
  if (template.watermarkMode === 'none') return null;
  if (template.watermarkMode === 'image' && !template.watermarkImage) return null;

  const angle = template.watermarkMode === 'image' ? WATERMARK_IMAGE_ANGLE : WATERMARK_TEXT_ANGLE;
  const layerStyle = {
    opacity: WATERMARK_OPACITY,
    transform: `rotate(${angle}deg)`,
  };

  // Repeat is a text-only option; an image watermark is always a single stamp.
  const tiled = template.watermarkMode === 'text' && template.watermarkTiled;

  const unit = (big: boolean) =>
    template.watermarkMode === 'image' ? (
      <img
        src={template.watermarkImage as string}
        alt=""
        className={
          big ? 'max-h-[55%] max-w-[70%] object-contain' : 'max-h-[6em] max-w-[6em] object-contain'
        }
      />
    ) : (
      <span
        className={`whitespace-nowrap font-extrabold uppercase text-gray-500 ${
          big ? 'text-[3.4em] tracking-[0.25em]' : 'text-[0.95em] tracking-[0.2em]'
        }`}
      >
        {template.watermarkText || 'DRAFT'}
      </span>
    );

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {tiled ? (
        <div
          className="grid h-full w-full grid-cols-3 grid-rows-4 place-items-center"
          style={layerStyle}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>{unit(false)}</div>
          ))}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center" style={layerStyle}>
          {unit(true)}
        </div>
      )}
    </div>
  );
}
