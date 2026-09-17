'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useNavigationLoaderStore } from '@/store/navigationLoader.store';

// Drop-in replacement for next/navigation's useRouter, for call sites that
// navigate programmatically (row/card clicks) rather than through a <Link>.
// useNavigationLoader.ts's click-detection only arms the overlay for real
// <a href> clicks; a plain onClick -> router.push() only reaches the loader
// via the history.pushState patch, which Next doesn't call until the
// navigation is already resolving — often too late for the overlay's
// SHOW_DELAY_MS to still catch it. Arming start() here, synchronously at the
// call site, closes that gap for details-page navigation.
export function useLoadingRouter() {
  const router = useRouter();
  const pathname = usePathname();

  const push: typeof router.push = (href, options) => {
    if (href !== pathname) {
      useNavigationLoaderStore.getState().start(pathname);
    }
    router.push(href, options);
  };

  return { ...router, push };
}
