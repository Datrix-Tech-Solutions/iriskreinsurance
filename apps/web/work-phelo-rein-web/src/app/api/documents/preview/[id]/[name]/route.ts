import { NextRequest } from 'next/server';
import { getPdf } from '@/lib/server/pdfPreviewStore';

export const runtime = 'nodejs';

/**
 * Streams a previously uploaded PDF back with `Content-Disposition: inline` and
 * the real document name, so the browser's own "Save as" proposes that name.
 * The `[name]` segment is cosmetic (keeps the URL readable) — the stored name
 * wins.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id } = await params;
  const record = getPdf(id);
  if (!record) {
    return new Response('This document preview has expired. Please reopen it.', { status: 404 });
  }

  const filename = record.name.replace(/"/g, '');
  return new Response(record.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      'Content-Length': String(record.bytes.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
}
