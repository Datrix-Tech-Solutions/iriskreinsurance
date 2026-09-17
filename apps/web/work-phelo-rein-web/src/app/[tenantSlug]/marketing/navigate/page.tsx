'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NavigatePage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${tenantSlug}/marketing/navigate/all-requests`);
  }, [tenantSlug, router]);

  return null;
}
