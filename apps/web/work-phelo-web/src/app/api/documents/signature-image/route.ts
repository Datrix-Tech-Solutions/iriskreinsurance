import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev-api.workphelo.com/api/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Same-origin proxy for a tenant's signature image. The document-profile API
 * only hands back a short-lived, cross-origin signed URL — no good for an
 * `<img>` that html2canvas has to rasterise. This route resolves a *fresh*
 * signed URL server-side (forwarding the caller's auth cookie) and streams the
 * bytes back from our own origin. Any failure is a 404 so the document falls
 * back to the bundled signature.
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId') ?? '';
  if (!UUID.test(tenantId)) {
    return new Response('Invalid tenant', { status: 400 });
  }

  const cookie = req.headers.get('cookie') ?? '';
  const authorization = req.headers.get('authorization') ?? '';

  let signatureUrl: string | null = null;
  let mimeType: string | null = null;
  try {
    const profileRes = await fetch(`${API_BASE}/auth/tenants/${tenantId}/document-profile`, {
      headers: {
        accept: 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
      cache: 'no-store',
    });
    if (!profileRes.ok) {
      return new Response('Profile unavailable', { status: 404 });
    }
    const profile = (await profileRes.json()) as {
      signatureUrl?: string | null;
      signatureMimeType?: string | null;
    };
    signatureUrl = profile.signatureUrl ?? null;
    mimeType = profile.signatureMimeType ?? null;
  } catch {
    return new Response('Profile fetch failed', { status: 404 });
  }

  if (!signatureUrl) {
    return new Response('No signature on file', { status: 404 });
  }

  try {
    const imgRes = await fetch(signatureUrl, { cache: 'no-store' });
    if (!imgRes.ok || !imgRes.body) {
      return new Response('Signature fetch failed', { status: 404 });
    }
    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('content-type') ?? mimeType ?? 'image/png',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response('Signature fetch failed', { status: 404 });
  }
}
