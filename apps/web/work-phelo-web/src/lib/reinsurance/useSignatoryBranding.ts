'use client';

import { useTenantDocumentProfile } from '@/hooks/useTenantDocumentProfile';
import { useAuthStore } from '@/store/auth.store';
import { SIGNATURE_SRC, SIGNATORY_NAME, SIGNATORY_TITLE } from './documentBranding';

export interface SignatoryBranding {
  /** Tenant signature image, or the hardcoded fallback. */
  signatureSrc: string;
  /** The hardcoded fallback on its own, for use as an <img> onError target. */
  fallbackSignatureSrc: string;
  signatoryName: string;
  signatoryTitle: string;
}

/**
 * The signing-block values for generated documents: the tenant's saved
 * signatory and signature image from the document profile, falling back to the
 * hardcoded iRisk branding.
 *
 * The signature image is served through the same-origin `/api/documents/
 * signature-image` proxy (the profile API only exposes a short-lived,
 * cross-origin signed URL, which an `<img>` html2canvas must rasterise can't
 * use). `?v=` busts the cache when a new signature is uploaded.
 */
export function useSignatoryBranding(): SignatoryBranding {
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const { data: profile } = useTenantDocumentProfile(tenantId);

  const hasSignature = Boolean(profile?.signatureUrl ?? profile?.signatureFileName);
  const signatureSrc =
    hasSignature && tenantId
      ? `/api/documents/signature-image?tenantId=${encodeURIComponent(tenantId)}&v=${
          profile?.version ?? 0
        }`
      : SIGNATURE_SRC;

  return {
    signatureSrc,
    fallbackSignatureSrc: SIGNATURE_SRC,
    signatoryName: profile?.authorizedSignatoryName || SIGNATORY_NAME,
    signatoryTitle: profile?.authorizedSignatoryTitle || SIGNATORY_TITLE,
  };
}
