const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CAPTURE_SCALE = 2; // content — stays crisp when the preview is zoomed
const BAND_SCALE = 1.5; // letterhead / footer / watermark — logo + text + QR only
const CONTENT_JPEG_QUALITY = 0.92;
const WATERMARK_WIDTH_MM = 175;
const STAGE_WIDTH_PX = 900;

function pdfFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || 'document';
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}

let depsPreload: Promise<unknown> | null = null;

/**
 * Warm the heavy PDF libraries (`html2canvas-pro`, `jspdf`) before the first
 * Print click so that click doesn't stall on the chunk download + parse. Safe to
 * call repeatedly — the dynamic imports are module-cached.
 */
export function preloadDocumentPdfDeps(): void {
  if (depsPreload || typeof window === 'undefined') return;
  depsPreload = Promise.allSettled([import('html2canvas-pro'), import('jspdf')]);
}

/**
 * Shows `blob` in an already-opened tab as a clean, full-page PDF preview whose
 * *native* "Save as" proposes `fileName`. The browser only honours a filename
 * that comes from an HTTP response, so the PDF is round-tripped through
 * `/api/documents/preview` (which streams it back with `Content-Disposition`).
 * Falls back to a plain `blob:` URL (unnamed) if that request fails.
 */
export async function openPdfPreview(win: Window, blob: Blob, fileName: string) {
  const name = pdfFileName(fileName);
  try {
    const res = await fetch('/api/documents/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-Document-Name': encodeURIComponent(name),
      },
      body: blob,
    });
    if (!res.ok) throw new Error(`preview upload failed: ${res.status}`);
    const { id } = (await res.json()) as { id: string };
    if (win.closed) return;
    win.location.href = `/api/documents/preview/${id}/${encodeURIComponent(name)}`;
  } catch (error) {
    console.error('Named PDF preview unavailable, falling back to blob URL', error);
    if (!win.closed) win.location.href = URL.createObjectURL(blob);
  }
}

/**
 * Makes a `display:none` print root renderable for html2canvas while keeping it
 * completely off-screen. A `transform` on the root makes it the containing block
 * for its `position:fixed` letterhead/watermark, so the whole thing shifts out
 * of view instead of flashing as a full-screen overlay. Returns a restore fn.
 */
export function stagePrintRoot(el: HTMLElement): () => void {
  const prev = el.getAttribute('style') ?? '';
  Object.assign(el.style, {
    display: 'block',
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${STAGE_WIDTH_PX}px`,
    transform: 'translateX(-3000px)',
    pointerEvents: 'none',
    zIndex: '-1',
  } as Partial<CSSStyleDeclaration>);
  return () => {
    el.setAttribute('style', prev);
  };
}

async function captureElement(el: HTMLElement, transparent = false, scale = CAPTURE_SCALE) {
  // Tailwind v4 emits colors as lab()/oklch() for modern browsers, which the
  // classic html2canvas can't parse — html2canvas-pro is a drop-in fork that
  // adds support for those color functions.
  const { default: html2canvas } = await import('html2canvas-pro');
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: transparent ? null : '#ffffff',
    logging: false,
  });
}

// The letterhead, footer and watermark are identical for every document in a
// session, but each html2canvas call re-clones the whole document — the costly
// part. Cache the band captures by their markup so only the first print pays.
const bandCanvasCache = new Map<string, HTMLCanvasElement>();

async function captureBand(
  el: HTMLElement,
  { transparent = false, scale = BAND_SCALE }: { transparent?: boolean; scale?: number } = {},
): Promise<HTMLCanvasElement> {
  const key = `${scale}|${transparent ? 't' : 'o'}|${el.outerHTML}`;
  const cached = bandCanvasCache.get(key);
  if (cached) return cached;
  const canvas = await captureElement(el, transparent, scale);
  // Don't cache a degenerate capture (e.g. an image that hadn't loaded yet) —
  // the next print should get a real shot at it.
  if (canvas.width > 0 && canvas.height > 0) bandCanvasCache.set(key, canvas);
  return canvas;
}

/**
 * Vertical offsets within the captured content canvas (in canvas pixels) where a
 * page break may fall without slicing through a line of text or a keep-together
 * block. We take the top edge of every candidate block, then drop any that land
 * *inside* a block that must not be split — an explicit `[data-print-block]`, a
 * single rich-text table row (`[data-rich-text] tr`), or anything with
 * `break-inside: avoid` — so a nested paragraph collapses onto its atomic
 * wrapper and that wrapper moves to the next page as one piece.
 *
 * A rich-text table is *not* kept together as a whole: the page may break
 * between its rows (a row is still never sliced through its text), so a table
 * longer than a page paginates row-by-row instead of being hard-cut. The
 * `[data-print-block]` that wraps such a table is exempted from atomicity for
 * the same reason.
 *
 * Must run while the print root is still staged (laid out) and after the
 * content's print-only `minHeight` has been cleared, so offsets line up with the
 * captured canvas. Returns `[0]` if the content isn't measurable, which makes
 * the slicer fall back to fixed page-height cuts.
 */
function collectBreakOffsets(content: HTMLElement, canvasHeight: number): number[] {
  if (!content.offsetHeight) return [0];
  const scale = canvasHeight / content.offsetHeight;
  const contentTop = content.getBoundingClientRect().top;
  const toOffset = (clientTop: number) => (clientTop - contentTop) * scale;

  const candidates = Array.from(
    content.querySelectorAll<HTMLElement>(
      'p, li, tr, h1, h2, h3, h4, h5, h6, [data-doc-field], [data-print-block]',
    ),
  )
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.height > 0)
    .map((rect) => toOffset(rect.top));

  // Blocks that must never be sliced: explicit markers, individual rich-text
  // table rows, and anything asking for `break-inside: avoid` — which in this
  // inline-styled print markup only comes from an inline style or a Tailwind
  // `break-inside-avoid` class. Checking just those elements avoids a
  // `getComputedStyle` call for every node in the tree.
  const atomicSelector = '[data-print-block], [data-rich-text] tr';
  const breakAvoidSelector = '[style*="break-inside"], [class*="break-inside-avoid"]';
  const atomicBoxes = Array.from(
    content.querySelectorAll<HTMLElement>(`${atomicSelector}, ${breakAvoidSelector}`),
  )
    .filter((el) => {
      // A print-block that wraps a rich-text table can't stay atomic — the table
      // may run past a page; its rows (also atomic) still can't be sliced.
      if (el.matches('[data-print-block]') && el.querySelector('[data-rich-text] table')) {
        return false;
      }
      return el.matches(atomicSelector) || getComputedStyle(el).breakInside === 'avoid';
    })
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: toOffset(rect.top), bottom: toOffset(rect.bottom) };
    })
    .filter((box) => box.bottom - box.top > 2);

  const valid = candidates.filter(
    (offset) => !atomicBoxes.some((box) => offset > box.top + 1 && offset < box.bottom - 1),
  );

  return Array.from(new Set([0, ...valid.map((offset) => Math.round(offset))])).sort(
    (a, b) => a - b,
  );
}

/** Waits for every <img> under `el` to finish loading so captures don't miss images. */
async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

/**
 * Rasterizes a document's print layout (built by `DocumentPrintLayout`) into a
 * real, multi-page A4 PDF.
 *
 * Per page: one flat JPEG holds the faint watermark (`[data-print-watermark]`)
 * with a slice of the transparent content canvas composited on top — so the
 * watermark still shows through the gaps in the text — then the cached
 * header/footer PNGs are drawn over it. html2canvas can't replicate
 * `position: fixed` elements across sliced pages, so that repetition is manual.
 */
export async function renderPrintRootToPdf(root: HTMLElement, title: string): Promise<Blob> {
  const header = root.querySelector<HTMLElement>('[data-print-header]');
  const footer = root.querySelector<HTMLElement>('[data-print-footer]');
  const content = root.querySelector<HTMLElement>('[data-print-content]');
  const watermark =
    root.querySelector<HTMLElement>('[data-print-watermark] img') ??
    root.querySelector<HTMLElement>('[data-print-watermark]');
  if (!content) throw new Error('Print content not found');

  await waitForImages(root);

  // Fixed-position bands capture cleanly once un-pinned from the viewport; the
  // content block's viewport-relative minHeight (which pushes the sign-off to
  // the bottom of a *printed* page) only makes sense under @media print, so drop
  // it for a natural-height capture here.
  const prevHeaderPosition = header?.style.position ?? '';
  const prevFooterPosition = footer?.style.position ?? '';
  const prevWatermarkPosition = watermark?.style.position ?? '';
  const prevContentMinHeight = content.style.minHeight;
  if (header) header.style.position = 'static';
  if (footer) footer.style.position = 'static';
  if (watermark) watermark.style.position = 'static';
  content.style.minHeight = 'auto';

  let headerCanvas: HTMLCanvasElement | null = null;
  let footerCanvas: HTMLCanvasElement | null = null;
  let watermarkCanvas: HTMLCanvasElement | null = null;
  let contentCanvas: HTMLCanvasElement;
  let breakOffsets: number[] = [0];
  try {
    [headerCanvas, footerCanvas, watermarkCanvas, contentCanvas] = await Promise.all([
      header ? captureBand(header) : Promise.resolve(null),
      footer ? captureBand(footer) : Promise.resolve(null),
      watermark ? captureBand(watermark, { transparent: true }) : Promise.resolve(null),
      captureElement(content, true),
    ]);
    // Measure now, while the root is still staged and `minHeight` is cleared.
    breakOffsets = collectBreakOffsets(content, contentCanvas.height);
  } finally {
    if (header) header.style.position = prevHeaderPosition;
    if (footer) footer.style.position = prevFooterPosition;
    if (watermark) watermark.style.position = prevWatermarkPosition;
    content.style.minHeight = prevContentMinHeight;
  }

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title });

  const headerHmm = headerCanvas ? (headerCanvas.height / headerCanvas.width) * A4_WIDTH_MM : 0;
  const footerHmm = footerCanvas ? (footerCanvas.height / footerCanvas.width) * A4_WIDTH_MM : 0;
  const contentWmm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentAreaHmm = A4_HEIGHT_MM - headerHmm - footerHmm - PAGE_MARGIN_MM * 2;

  const pxPerMm = contentCanvas.width / contentWmm;
  const maxSliceHeightPx = Math.max(1, Math.floor(contentAreaHmm * pxPerMm));

  // Where the page-centred watermark falls *within* a content slice. It's the
  // same on every page (each page's content image shares one origin below the
  // header), so baking it into the slice lets that slice be a flat JPEG — far
  // cheaper to encode than a transparent PNG — while still showing through the
  // gaps in the text.
  const watermarkHmm = watermarkCanvas
    ? (watermarkCanvas.height / watermarkCanvas.width) * WATERMARK_WIDTH_MM
    : 0;
  const watermarkRect = watermarkCanvas
    ? {
        x: ((A4_WIDTH_MM - WATERMARK_WIDTH_MM) / 2 - PAGE_MARGIN_MM) * pxPerMm,
        y: ((A4_HEIGHT_MM - watermarkHmm) / 2 - (headerHmm + PAGE_MARGIN_MM)) * pxPerMm,
        w: WATERMARK_WIDTH_MM * pxPerMm,
        h: watermarkHmm * pxPerMm,
      }
    : null;

  // Turn the legal break offsets into concrete page boundaries: each page takes
  // as many whole blocks as fit in `maxSliceHeightPx`, snapping its bottom edge
  // to the largest break offset that fits. A block taller than a full page has
  // no legal break inside it, so it's hard-cut at the page height.
  const pageStarts = [0];
  let cursor = 0;
  while (cursor < contentCanvas.height) {
    const idealEnd = cursor + maxSliceHeightPx;
    if (idealEnd >= contentCanvas.height) break;
    let cut = idealEnd;
    for (const offset of breakOffsets) {
      if (offset > cursor && offset <= idealEnd) cut = offset;
      else if (offset > idealEnd) break;
    }
    if (cut <= cursor) cut = idealEnd;
    pageStarts.push(cut);
    cursor = cut;
  }

  for (let page = 0; page < pageStarts.length; page++) {
    if (page > 0) pdf.addPage();

    // Letterhead / footer: captured once and cached, kept as lossless PNG so the
    // QR code stays crisp and scannable.
    if (headerCanvas) {
      pdf.addImage(headerCanvas, 'PNG', 0, 0, A4_WIDTH_MM, headerHmm);
    }
    if (footerCanvas) {
      pdf.addImage(footerCanvas, 'PNG', 0, A4_HEIGHT_MM - footerHmm, A4_WIDTH_MM, footerHmm);
    }

    const startPx = pageStarts[page];
    const endPx = page + 1 < pageStarts.length ? pageStarts[page + 1] : contentCanvas.height;
    const usedPx = Math.min(endPx, contentCanvas.height) - startPx;
    if (usedPx <= 0) continue;

    // One flat JPEG per page: white ground, the page-centred watermark, then the
    // content slice on top. Every page is the full content-area height so the
    // watermark never clips on a short final page — the white tail below the
    // content is just what a normal last page looks like.
    const slice = document.createElement('canvas');
    slice.width = contentCanvas.width;
    slice.height = maxSliceHeightPx;
    const ctx = slice.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    if (watermarkCanvas && watermarkRect) {
      ctx.drawImage(
        watermarkCanvas,
        watermarkRect.x,
        watermarkRect.y,
        watermarkRect.w,
        watermarkRect.h,
      );
    }
    ctx.drawImage(
      contentCanvas,
      0,
      startPx,
      contentCanvas.width,
      usedPx,
      0,
      0,
      contentCanvas.width,
      usedPx,
    );

    pdf.addImage(
      slice.toDataURL('image/jpeg', CONTENT_JPEG_QUALITY),
      'JPEG',
      PAGE_MARGIN_MM,
      headerHmm + PAGE_MARGIN_MM,
      contentWmm,
      contentAreaHmm,
      undefined,
      'FAST',
    );
  }

  return pdf.output('blob');
}
