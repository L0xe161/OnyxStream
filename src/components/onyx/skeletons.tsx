"use client";

import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";

/** Skeletons share the real components' dimensions so nothing shifts when data arrives. */

export function MediaCardSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="shimmer aspect-[2/3] w-full rounded-[var(--radius-lg)]" />
      <div className="shimmer h-4 w-3/4 rounded-full" />
      <div className="shimmer h-3 w-1/2 rounded-full" />
    </div>
  );
}

export function CategoryRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden>
      <div className="shimmer mb-[var(--space-row)] h-7 w-48 rounded-full" />
      <div className="-mx-[var(--gutter)] flex gap-4 overflow-hidden px-[var(--gutter)]">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[var(--poster-w)] shrink-0">
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="shimmer min-h-[clamp(26rem,74svh,54rem)] w-full" aria-hidden />
  );
}

/** Loading state for a discover tab: hero first, then rows, matching the live layout. */
export function CatalogSkeleton() {
  const t = getT(useOnyxStore((st) => st.lang));
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t.loadingCatalog}</span>
      <HeroSkeleton />
      <div className="mx-auto max-w-[110rem] space-y-[var(--space-section)] px-[var(--gutter)] py-[var(--space-section)]">
        <CategoryRowSkeleton />
        <CategoryRowSkeleton />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--poster-w),1fr))] gap-x-4 gap-y-8" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </div>
  );
}
