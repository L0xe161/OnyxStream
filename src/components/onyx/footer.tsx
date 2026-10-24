"use client";

import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";

/**
 * Footer: the brand name + tagline, then the three localized credit lines
 * (designer link, store-visit line, developer handle).
 */
export function Footer() {
  const t = getT(useOnyxStore((s) => s.lang));

  return (
    <footer className="mt-auto bg-secondary/60 pb-28 pt-12 lg:pb-12">
      <div className="mx-auto max-w-[110rem] px-[var(--gutter)]">
        <div className="mb-6">
          <p className="font-display text-[clamp(2rem,1.4rem+2vw,3rem)] font-medium leading-[0.95] tracking-[-0.03em] text-foreground/90" dir="auto">
            {t.siteTitle}
          </p>
          <p className="mt-1 text-meta text-muted-foreground" dir="auto">{t.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 text-meta text-muted-foreground">
          <p>
            {t.footerDesigner}
            <a
              href="https://aqeeq-store.vercel.app/shop"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-foreground underline decoration-1 underline-offset-4 hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              https://aqeeq-store.vercel.app/shop
            </a>
          </p>
          <p>{t.footerStoreLine}</p>
          <p>
            {t.footerDeveloper}
            <a
              href="https://t.me/Myf4ul1"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-foreground underline decoration-1 underline-offset-4 hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              @Myf4ul1
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

