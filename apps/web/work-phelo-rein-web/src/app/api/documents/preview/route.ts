import { NextRequest, NextResponse } from 'next/server';
import { putPdf } from '@/lib/server/pdfPreviewStore';

export const runtime = 'nodejs';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Accepts a generated PDF (raw `application/pdf` body, name in the
 * `X-Document-Name` header) and returns `{ id }`. The client then opens
 * `/api/documents/preview/<id>/<name>.pdf` to view/save it with a proper name.
 */
export async function POST(req: NextRequest) {
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'PDF too large' }, { status: 413 });
  }

  const rawName = req.headers.get('x-document-name') ?? 'document';
  let name = 'document';
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  name =
    name
      .replace(/[\r\n"\\]+/g, ' ')
      .trim()
      .slice(0, 200) || 'document';
  if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;

  const id = putPdf(body, name);
  return NextResponse.json({ id });
}
