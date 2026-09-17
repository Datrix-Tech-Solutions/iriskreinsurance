'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigationLoaderStore } from '@/store/navigationLoader.store';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 350;
const FADE_MS = 150;
// Last-resort circuit breaker, not the normal close path — the overlay is meant to
// hide only once the "landed" effect below sees the pathname actually change. On a
// slow network a real navigation can take several seconds; this must be long enough
// that it never fires for that case, so it only ever catches a genuinely stuck/failed
// navigation (bad redirect, hung request) instead of masking one as a normal load.
const SAFETY_MS = 20000;

declare global {
  interface Window {
    __navLoaderPatched?: boolean;
  }
}

function toPathname(url: string | URL | null | undefined): string | null {
  if (url == null) return null;
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return null;
  }
}

// Patches the History API once per browser session (guarded on `window` itself,
// not a module-level flag, since Fast Refresh can re-run this module's top-level
// code without a full reload). Every client-side navigation — Link clicks and
// router.push alike — flows through pushState/replaceState, so this catches all
// of it without touching any of the existing call sites.
function installNavigationLoaderPatch() {
  if (typeof window === 'undefined' || window.__navLoaderPatched) return;
  window.__navLoaderPatched = true;

  let lastPathname = window.location.pathname;

  // Next's App Router calls pushState/replaceState from inside a
  // useInsertionEffect for its own navigation bookkeeping — updating the store
  // synchronously in that call frame trips React's "useInsertionEffect must
  // not schedule updates" guard. Deferring by a microtask runs it just after
  // that frame unwinds, well within SHOW_DELAY_MS's budget either way.
  const scheduleStart = (fromPath: string) => {
    queueMicrotask(() => useNavigationLoaderStore.getState().start(fromPath));
  };

  const handleUrlChange = (url: string | URL | null | undefined) => {
    const next = toPathname(url);
    if (next == null) return;
    if (next !== lastPathname) {
      scheduleStart(lastPathname);
    }
    lastPathname = next;
  };

  const originalPush = window.history.pushState.bind(window.history);
  window.history.pushState = function (data: unknown, _unused: string, url?: string | URL | null) {
    handleUrlChange(url);
    return originalPush(data, _unused, url);
  };

  const originalReplace = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (
    data: unknown,
    _unused: string,
    url?: string | URL | null,
  ) {
    handleUrlChange(url);
    return originalReplace(data, _unused, url);
  };

  // By the time `popstate` fires (browser back/forward), window.location has
  // already moved — that's fine, this is only the *start* signal. Landed
  // detection below trusts Next's own usePathname() instead, never this.
  window.addEventListener('popstate', () => {
    const next = window.location.pathname;
    if (next !== lastPathname) {
      scheduleStart(lastPathname);
    }
    lastPathname = next;
  });

  // Next only calls pushState once a navigation actually starts resolving
  // (first byte back from the server) — during a slow/cold route (dev
  // on-demand compile, throttled network) that leaves a visible gap between
  // the click and any History API activity. Catching the click itself closes
  // that gap for Link-driven navigation, without needing to touch any of the
  // existing <Link> usages. Programmatic-only router.push() (no <a> involved)
  // still falls back to the pushState patch above.
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.hasAttribute('download')) return;

      const target = anchor.getAttribute('target');
      if (target && target !== '_self') return;

      let url: URL;
      try {
        url = new URL(anchor.getAttribute('href')!, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      scheduleStart(window.location.pathname);
    },
    true,
  );
}

installNavigationLoaderPatch();

export function useNavigationLoader() {
  const isNavigating = useNavigationLoaderStore((s) => s.isNavigating);
  const originPath = useNavigationLoaderStore((s) => s.originPath);
  const finish = useNavigationLoaderStore((s) => s.finish);

  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const shownAtRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Arm the show-delay and safety timers whenever a new navigation starts.
  useEffect(() => {
    if (!isNavigating) return;

    timersRef.current.push(
      setTimeout(() => {
        setVisible(true);
        shownAtRef.current = Date.now();
      }, SHOW_DELAY_MS),
      setTimeout(() => setClosing(true), SAFETY_MS),
    );

    return clearTimers;
  }, [isNavigating, originPath]);

  // Landed detection — pathname has diverged from where the navigation started.
  useEffect(() => {
    if (!isNavigating || closing) return;
    if (pathname === originPath) return;

    clearTimers();

    if (!shownAtRef.current) {
      // Resolved before the overlay ever became visible — reset silently, no flash.
      finish();
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    timersRef.current.push(
      setTimeout(() => setClosing(true), Math.max(0, MIN_VISIBLE_MS - elapsed)),
    );
  }, [pathname, isNavigating, originPath, closing, finish]);

  // Fade out, then reset local + store state.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      finish();
      setClosing(false);
      setVisible(false);
      shownAtRef.current = null;
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [closing, finish]);

  return { visible, closing, fadeMs: FADE_MS };
}
