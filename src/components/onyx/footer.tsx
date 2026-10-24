"use client";

import { useOnyxStore } from "@/lib/store";
import { getT } from "@/lib/i18n";

/**
 * Footer credits — strictly the three localized lines required by the spec:
 * designer link, store-visit line, developer handle. Nothing else.
 */
export function Footer() {
  const t = getT(useOnyxStore((s) => s.lang));

  return (
    <footer className="mt-auto bg-secondary/60 pb-28 pt-12 lg:pb-12">
      <div className="mx-auto flex max-w-[110rem] flex-col gap-2 px-[var(--gutter)] text-meta text-muted-foreground">
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
    </footer>
  );
}
