'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Companion to AutoHideScrollbars: that component makes the native scrollbar
// fade in only while actively scrolling, which is invisible to a user who
// can't drive a scroll gesture in the first place (broken wheel/trackpad,
// some assistive setups). This renders a small pair of click-to-scroll arrows
// at the ends of wherever that scrollbar's track would be, on hover/focus of
// any scrollable element on the page — so there's always a clickable way in.

const HOLD_JUMP_DELAY_MS = 450; // how long a press must be held before it jumps to the edge
const STEP_RATIO = 0.85; // fraction of the container's viewport scrolled per click
const HIDE_GRACE_MS = 150; // delay before hiding, so the pointer can cross onto the buttons
const BUTTON_SIZE = 22;
const INSET = 5;

type ScrollTarget = { el: Element; axisY: boolean; axisX: boolean };

function isScrollableY(el: Element) {
  const style = getComputedStyle(el);
  return (
    (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
    el.scrollHeight > el.clientHeight + 1
  );
}

function isScrollableX(el: Element) {
  const style = getComputedStyle(el);
  return (
    (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
    el.scrollWidth > el.clientWidth + 1
  );
}

// Walks up from the hovered/focused node to find the nearest scrollable
// ancestor, falling back to the page itself if none of them scroll.
function findScrollTarget(start: Element | null): ScrollTarget | null {
  let el = start;
  let depth = 0;
  while (el && el !== document.documentElement && depth < 40) {
    const axisY = isScrollableY(el);
    const axisX = isScrollableX(el);
    if (axisY || axisX) return { el, axisY, axisX };
    el = el.parentElement;
    depth++;
  }

  const doc = document.documentElement;
  const axisY = doc.scrollHeight > window.innerHeight + 1;
  const axisX = doc.scrollWidth > window.innerWidth + 1;
  return axisY || axisX ? { el: doc, axisY, axisX } : null;
}

function scrollStep(el: Element, axis: 'x' | 'y', dir: 1 | -1) {
  const amount = (axis === 'y' ? el.clientHeight : el.clientWidth) * STEP_RATIO * dir;
  const opts: ScrollToOptions =
    axis === 'y' ? { top: amount, behavior: 'smooth' } : { left: amount, behavior: 'smooth' };
  if (el === document.documentElement) window.scrollBy(opts);
  else el.scrollBy(opts);
}

function scrollToEdge(el: Element, axis: 'x' | 'y', dir: 1 | -1) {
  const value = axis === 'y' ? (dir === 1 ? el.scrollHeight : 0) : dir === 1 ? el.scrollWidth : 0;
  const opts: ScrollToOptions =
    axis === 'y' ? { top: value, behavior: 'smooth' } : { left: value, behavior: 'smooth' };
  if (el === document.documentElement) window.scrollTo(opts);
  else el.scrollTo(opts);
}

interface NudgeButtonProps {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  style: CSSProperties;
  onStep: () => void;
  onJump: () => void;
}

// A single arrow: a quick press steps one screenful, holding it past the
// threshold jumps straight to the start/end of the scrollable content.
function NudgeButton({ icon: Icon, label, disabled, style, onStep, onJump }: NudgeButtonProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumped = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        'pointer-events-auto absolute flex items-center justify-center rounded-full',
        'bg-black/45 text-white shadow-sm backdrop-blur-sm transition-colors',
        'hover:bg-(--module-btn-bg,var(--color-brand)) disabled:opacity-0 disabled:pointer-events-none',
      )}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, touchAction: 'none', ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        jumped.current = false;
        holdTimer.current = setTimeout(() => {
          jumped.current = true;
          onJump();
        }, HOLD_JUMP_DELAY_MS);
      }}
      onPointerUp={() => {
        clearHold();
        if (!jumped.current) onStep();
      }}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
    </button>
  );
}

export function ScrollNudgeButtons() {
  const [target, setTarget] = useState<ScrollTarget | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [edges, setEdges] = useState({ top: true, bottom: true, left: true, right: true });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setTarget(null), HIDE_GRACE_MS);
  }, [clearHideTimer]);

  // Track whatever's currently hovered or keyboard-focused, anywhere in the
  // document — mirrors the capture-phase-on-document approach AutoHideScrollbars
  // uses to reach nested scrollable elements it doesn't own.
  useEffect(() => {
    const resolve = (target: EventTarget | null) =>
      findScrollTarget(target instanceof Element ? target : null);

    const isOwnButton = (node: EventTarget | null) =>
      node instanceof Element && !!node.closest('[data-scroll-nudge]');

    const handleOver = (e: MouseEvent) => {
      if (isOwnButton(e.target)) return;
      const found = resolve(e.target);
      if (found) {
        clearHideTimer();
        setTarget((prev) => (prev?.el === found.el ? prev : found));
      }
    };

    const handleOut = (e: MouseEvent) => {
      if (isOwnButton(e.relatedTarget)) return;
      scheduleHide();
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isOwnButton(e.target)) return;
      const found = resolve(e.target);
      if (found) {
        clearHideTimer();
        setTarget((prev) => (prev?.el === found.el ? prev : found));
      }
    };

    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseout', handleOut);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseout', handleOut);
      document.removeEventListener('focusin', handleFocusIn);
      clearHideTimer();
    };
  }, [clearHideTimer, scheduleHide]);

  // While a target is tracked, keep its position and scroll-limit state in
  // sync — a rAF loop is the simplest way to stay correct through arbitrary
  // nested scrolling/resizing without wiring a listener per ancestor. Uses
  // useLayoutEffect so the first measurement lands before paint — otherwise
  // a newly-hovered target would flash for a frame at the previous target's
  // position.
  useLayoutEffect(() => {
    if (!target) return;

    let rafId: number;
    const update = () => {
      const el = target.el;
      const r =
        el === document.documentElement
          ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
          : el.getBoundingClientRect();
      setRect(r);
      setEdges({
        top: el.scrollTop <= 0,
        bottom: el.scrollTop >= el.scrollHeight - el.clientHeight - 1,
        left: el.scrollLeft <= 0,
        right: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1,
      });
      rafId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  if (!target || !rect) return null;

  const { el, axisY, axisX } = target;
  // Where the two tracks would overlap in a corner (both axes scrollable),
  // leave room so the vertical and horizontal arrows don't sit on top of each other.
  const trackGap = BUTTON_SIZE + INSET;

  return createPortal(
    <div
      data-scroll-nudge
      className="pointer-events-none fixed z-60"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        animation: 'scroll-nudge-in 150ms ease-out',
      }}
      onMouseEnter={clearHideTimer}
      onMouseLeave={scheduleHide}
    >
      {axisY && (
        <>
          <NudgeButton
            icon={ChevronUp}
            label="Scroll up"
            disabled={edges.top}
            style={{ top: INSET, right: INSET }}
            onStep={() => scrollStep(el, 'y', -1)}
            onJump={() => scrollToEdge(el, 'y', -1)}
          />
          <NudgeButton
            icon={ChevronDown}
            label="Scroll down"
            disabled={edges.bottom}
            style={{ bottom: axisX ? trackGap : INSET, right: INSET }}
            onStep={() => scrollStep(el, 'y', 1)}
            onJump={() => scrollToEdge(el, 'y', 1)}
          />
        </>
      )}
      {axisX && (
        <>
          <NudgeButton
            icon={ChevronLeft}
            label="Scroll left"
            disabled={edges.left}
            style={{ bottom: INSET, left: INSET }}
            onStep={() => scrollStep(el, 'x', -1)}
            onJump={() => scrollToEdge(el, 'x', -1)}
          />
          <NudgeButton
            icon={ChevronRight}
            label="Scroll right"
            disabled={edges.right}
            style={{ bottom: INSET, right: axisY ? trackGap : INSET }}
            onStep={() => scrollStep(el, 'x', 1)}
            onJump={() => scrollToEdge(el, 'x', 1)}
          />
        </>
      )}
    </div>,
    document.body,
  );
}
