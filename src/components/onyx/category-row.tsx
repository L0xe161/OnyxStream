"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "./media-card";
import { useOnyxStore } from "@/lib/store";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { getT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Language, TMDBMediaItem } from "@/lib/types";

interface CategoryRowProps {
  title: string;
  items: TMDBMediaItem[];
  lang: Language;
  bilingual?: boolean;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
  onPrefetch?: (media: TMDBMediaItem) => void;
}

const arrow =
  "grid size-10 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-30";

export function CategoryRow({ title, items, lang, bilingual = false, onPlay, onSelectDetails, onPrefetch }: CategoryRowProps) {
  const t = getT(lang);
  const layout = useOnyxStore((s) => s.settings.browseLayout);
  const scroller = useRef<HTMLDivElement>(null);
  // Drag-to-scroll uses the same element as `scroller` so the measure/page
  // logic and the drag handlers share one node.
  const drag = useDragScroll<HTMLDivElement>(scroller);
  const [edge, setEdge] = useState({ start: true, end: false });

  /** Works in LTR and RTL: scrollLeft is negative in RTL, so measure its magnitude. */
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const offset = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEdge((prev) => {
      const next = { start: offset < 4, end: offset > max - 4 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el || layout === "grid") return;
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [measure, layout, items.length]);

  const page = (towardEnd: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const sign = (towardEnd ? 1 : -1) * (rtl ? -1 : 1);
    el.scrollBy({ left: sign * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;
  const isGrid = layout === "grid";

  return (
    <section aria-label={title} className="group/row">
      <div className="mb-[var(--space-row)] flex items-end justify-between gap-4">
        <h2 className="font-display text-title font-medium" dir="auto">
          {title}
        </h2>
        {!isGrid && (
          <div className="hidden items-center gap-2 sm:flex">
            <button type="button" className={arrow} onClick={() => page(false)} disabled={edge.start} aria-label={t.scrollBack}>
              <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
            <button type="button" className={arrow} onClick={() => page(true)} disabled={edge.end} aria-label={t.scrollForward}>
              <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
        className={cn(
          isGrid
            ? "grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8"
            : "drag-scroll -mx-[var(--gutter)] flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain scroll-ps-[var(--gutter)] px-[var(--gutter)] pb-2 scrollbar-none"
        )}
      >
        {items.map((item) => (
          <div key={`${item.id}-${item.media_type ?? ""}`} className={cn(!isGrid && "w-[var(--poster-w)] shrink-0 snap-start")}>
            <MediaCard media={item} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} onPrefetch={onPrefetch} />
          </div>
        ))}
      </div>
    </section>
  );
}
