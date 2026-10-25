"use client";

import { useCallback, useRef, type RefObject } from "react";

/** Pixels of pointer travel before a press counts as a drag (not a click). */
const DRAG_THRESHOLD = 4;

/**
 * Adds mouse-driven click-and-drag horizontal scrolling to a horizontal
 * scroller. The caller owns the element ref (created with `useRef`) and passes
 * it in; the hook returns stable pointer-event handlers to spread on the same
 * element.
 *
 * - Touch pointers are ignored: native horizontal swipe scrolling stays intact.
 * - Keyboard, trackpad and mouse-wheel scrolling are untouched.
 * - A press that travels more than `DRAG_THRESHOLD` pixels suppresses the
 *   next synthetic `click` event (captured at the document level, so it fires
 *   before React's root-delegated listener) — that way a scroll gesture can
 *   never accidentally open a card or a person.
 *
 * The handlers toggle a `data-dragging="true"` attribute on the element for
 * the lifetime of the drag; pair them with the `.drag-scroll` CSS class so
 * text selection is suppressed (`user-select: none`) and the cursor flips to
 * `grabbing` while the user is dragging.
 *
 * The ref is typed `RefObject<T | null>` to match what `useRef<T>(null)`
 * returns under React 19's types.
 */
export function useDragScroll<T extends HTMLElement>(elRef: RefObject<T | null>) {
  const state = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: false,
    pointerId: -1,
    rtl: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    // Only the primary mouse/pen button starts a drag; touch uses native
    // horizontal-scroll gestures and must not be hijacked.
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    const el = elRef.current;
    if (!el) return;
    state.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
      // `scrollLeft` is negative toward the end in RTL layouts, so the drag
      // delta has to be applied with the opposite sign to keep the gesture
      // feeling natural in both directions.
      rtl: getComputedStyle(el).direction === "rtl",
    };
    // Capture the pointer so we keep receiving move/up events even if the
    // cursor leaves the scroller bounds mid-drag.
    el.setPointerCapture?.(e.pointerId);
    el.dataset.dragging = "true";
  }, [elRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    const el = elRef.current;
    if (!el) return;
    const delta = e.clientX - s.startX;
    if (!s.moved && Math.abs(delta) > DRAG_THRESHOLD) s.moved = true;
    // In LTR, dragging left (negative delta) scrolls toward the end
    // (scrollLeft increases). In RTL, scrollLeft decreases (goes negative)
    // toward the end, so the delta is applied with the opposite sign.
    el.scrollLeft = s.startScroll + delta * (s.rtl ? 1 : -1);
  }, [elRef]);

  const endDrag = useCallback((e: React.PointerEvent<T>) => {
    const s = state.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    s.active = false;
    const el = elRef.current;
    if (el) {
      delete el.dataset.dragging;
      el.releasePointerCapture?.(e.pointerId);
    }
    // If the pointer travelled far enough to count as a real drag (not a tap),
    // swallow the synthetic `click` the browser is about to dispatch so it
    // never reaches a card. The listener sits on `document` (capture phase)
    // so it runs before React's root-level delegated listener.
    if (s.moved) {
      const suppress = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
      };
      document.addEventListener("click", suppress, { capture: true, once: true });
      // Safety net: a large drag suppresses the native `click` event entirely,
      // so the `once` listener would otherwise linger. Clear it on the next
      // tick regardless.
      window.setTimeout(
        () => document.removeEventListener("click", suppress, { capture: true } as EventListenerOptions),
        0
      );
    }
  }, [elRef]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
}
