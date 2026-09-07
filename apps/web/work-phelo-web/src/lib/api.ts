import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Some pages (e.g. reinsurance claims) fan out one request per row via useQueries instead
// of a single aggregate endpoint. Left unbounded, that can throw 50-200+ requests at the
// browser at once, which pile up against its per-origin connection limit and stall
// everything, including unrelated requests elsewhere on the page. Cap how many of this
// client's requests are ever in flight at once and queue the rest — auth calls skip the
// queue so a 401 refresh never waits behind a backlog of data fetches.
const MAX_CONCURRENT_REQUESTS = 6;
const NO_QUEUE = ['/auth/refresh', '/auth/admin/login', '/auth/login'];
let activeRequestCount = 0;
const pendingSlotRequests: Array<() => void> = [];

function acquireRequestSlot(): Promise<void> {
  if (activeRequestCount < MAX_CONCURRENT_REQUESTS) {
    activeRequestCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pendingSlotRequests.push(() => {
      activeRequestCount++;
      resolve();
    });
  });
}

function releaseRequestSlot() {
  activeRequestCount--;
  pendingSlotRequests.shift()?.();
}

api.interceptors.request.use(async (config) => {
  if (NO_QUEUE.some((path) => config.url?.includes(path))) return config;
  await acquireRequestSlot();
  return config;
});

api.interceptors.response.use(
  (res) => {
    releaseRequestSlot();
    return res;
  },
  (error) => {
    if (!NO_QUEUE.some((path) => (error.config?.url ?? '').includes(path))) {
      releaseRequestSlot();
    }
    return Promise.reject(error);
  },
);

// Routes that should never trigger a token refresh attempt
const SKIP_REFRESH = ['/auth/refresh', '/auth/admin/login', '/auth/login'];

// Shared in-flight refresh promise — prevents concurrent 401s from each
// triggering their own refresh (which would burn the refresh token on the first
// success and cause all subsequent attempts to fail, logging the user out).
let refreshPromise: Promise<unknown> | null = null;

function isAuthPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/platform/login' ||
    /^\/[^/]+\/login$/.test(pathname) ||
    pathname.includes('/accept-invite') ||
    pathname.includes('/reset-password') ||
    pathname.includes('/verify-account') ||
    pathname.includes('/forgot-password')
  );
}

function redirectToLogin() {
  const path = window.location.pathname;
  if (isAuthPage(path)) return;
  const tenantMatch = path.match(/^\/([^/]+)\//);
  const isPlatform =
    !tenantMatch || tenantMatch[1] === 'platform' || tenantMatch[1] === 'dashboard';
  window.location.href = isPlatform ? '/platform/login' : `/${tenantMatch![1]}/login`;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';

    const shouldSkip = SKIP_REFRESH.some((path) => url.includes(path));

    if (error.response?.status === 401 && !original._retry && !shouldSkip) {
      original._retry = true;

      // If no refresh is in flight, start one; otherwise reuse the existing promise.
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  },
);
