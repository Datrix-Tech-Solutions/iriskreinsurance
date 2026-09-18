/**
 * Tiny in-memory hand-off for client-generated document PDFs.
 *
 * The browser can only be told a PDF's "Save as" filename through a real HTTP
 * response (`Content-Disposition`) — a `blob:` URL always saves as its random
 * id. So the client uploads the generated PDF here (POST) and then navigates a
 * tab to `/api/documents/preview/<id>/<name>.pdf` (GET), which streams it back
 * with the right headers.
 *
 * NOTE: this Map lives in the Node process, so it only works with a single
 * long-running server instance (our deployment). It is not suitable for
 * serverless / multi-instance hosting — swap for Redis or a blob store there.
 */

export interface StoredPdf {
  bytes: Uint8Array;
  name: string;
  expiresAt: number;
}

const store = new Map<string, StoredPdf>();
const TTL_MS = 5 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [id, value] of store) {
    if (value.expiresAt <= now) store.delete(id);
  }
}

export function putPdf(bytes: Uint8Array, name: string): string {
  sweep();
  const id = crypto.randomUUID();
  store.set(id, { bytes, name, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getPdf(id: string): StoredPdf | null {
  sweep();
  return store.get(id) ?? null;
}
