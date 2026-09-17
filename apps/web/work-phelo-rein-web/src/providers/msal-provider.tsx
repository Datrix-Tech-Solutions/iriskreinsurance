'use client';

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { ensureMsalInitialized, getMsalInstance, isMsalConfigured } from '@/lib/msal-config';

export function OutlookMsalProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isMsalConfigured()) return;
    ensureMsalInitialized().then(() => setReady(true));
  }, []);

  if (!isMsalConfigured()) {
    return <>{children}</>;
  }

  if (!ready) {
    return null;
  }

  return <MsalProvider instance={getMsalInstance()}>{children}</MsalProvider>;
}
