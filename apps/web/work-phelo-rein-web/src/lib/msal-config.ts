import { Configuration, PublicClientApplication } from '@azure/msal-browser';

const clientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID ?? '';
const tenantId = process.env.NEXT_PUBLIC_MSAL_TENANT_ID ?? '';

export function isMsalConfigured(): boolean {
  return Boolean(clientId);
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri:
      process.env.NEXT_PUBLIC_MSAL_REDIRECT_URI ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const outlookLoginRequest = {
  scopes: ['User.Read', 'Mail.Read', 'Mail.Send', 'offline_access'],
};

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

export function ensureMsalInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = getMsalInstance().initialize();
  }
  return initPromise;
}
