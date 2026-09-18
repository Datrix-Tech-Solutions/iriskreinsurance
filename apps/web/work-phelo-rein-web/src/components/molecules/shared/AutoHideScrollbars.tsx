'use client';

import { useEffect } from 'react';

// How long the scrollbar stays visible after the last scroll event, in ms.
// Only takes effect in Firefox — Chromium (Chrome/Edge) ignores this and
// applies its own fixed ~1s native fade-out once a scroll gesture ends,
// regardless of the `is-scrolling` class state; there's no CSS/JS hook to
// override that timing in Chromium, so this constant is tuned to roughly
// match it rather than the (unreachable) longer delays we tried.
const HIDE_DELAY_MS = 600000;

// Scrollbars are hidden by default (see globals.css) and only fade in while
// actively scrolling, then hide again — CSS has no ":scrolling" pseudo-class,
// so this is what drives the `is-scrolling` class that globals.css reacts to.
// Listens on the capture phase so it catches scroll events from ANY nested
// scrollable element (sidebar, tables, modals, the page itself...), not just
// window scroll — native `scroll` events don't bubble, so a bubble-phase
// listener on document would only ever see document's own scroll.
export function AutoHideScrollbars() {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

    const handleScroll = (e: Event) => {
      const target = e.target === document ? document.documentElement : e.target;
      if (!(target instanceof Element)) return;

      target.classList.add('is-scrolling');

      const existing = timers.get(target);
      if (existing) clearTimeout(existing);
      timers.set(
        target,
        setTimeout(() => {
          target.classList.remove('is-scrolling');
          timers.delete(target);
        }, HIDE_DELAY_MS),
      );
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, []);

  return null;
}
