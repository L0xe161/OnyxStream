"use client";

import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";

/** Closes the page: a large wordmark, one line of intent and the required attribution. */
export function Footer() {
  const t = getT(useOnyxStore((s) => s.lang));

  return (
    <footer className="mt-auto overflow-hidden bg-secondary/60 pb-28 pt-16 lg:pb-12">
      <div className="mx-auto max-w-[110rem] px-[var(--gutter)]">
        <p className="font-display text-[clamp(3rem,2rem+9vw,9rem)] font-medium leading-[0.9] tracking-[-0.04em] text-foreground/90" aria-hidden>
          {t.siteTitle}
        </p>
        <div className="mt-10 flex flex-col gap-3 text-meta text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-foreground">{t.footerLine}</p>
            <p>{t.footerRights}</p>
          </div>
          <p className="max-w-sm sm:text-end">{t.tmdbNotice}</p>
        </div>
      </div>
    </footer>
  );
}
