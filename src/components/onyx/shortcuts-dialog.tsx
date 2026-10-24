"use client";

import { Overlay, OverlayClose } from "./overlay";
import { X } from "lucide-react";
import { useOnyxStore } from "@/lib/store";
import { dirFor, getT } from "@/lib/i18n";
import { GLOBAL_SHORTCUTS, TAB_SHORTCUTS, type ShortcutInfo } from "@/lib/shortcuts";
import type { Language } from "@/lib/types";

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="grid h-7 min-w-7 place-items-center rounded-md bg-muted px-1.5 text-[0.8125rem] font-medium text-foreground tabular-nums">
          {k}
        </kbd>
      ))}
    </span>
  );
}

function Group({ title, items, lang }: { title: string; items: ShortcutInfo[]; lang: Language }) {
  const t = getT(lang);
  return (
    <section>
      <h3 className="mb-2 text-meta font-medium text-muted-foreground">{title}</h3>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.labelKey + item.keys.join()} className="flex items-center justify-between gap-6 py-2.5">
            <span>{t[item.labelKey]}</span>
            <Keys keys={item.keys} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShortcutsDialog({ lang }: { lang: Language }) {
  const open = useOnyxStore((s) => s.shortcutsOpen);
  const setOpen = useOnyxStore((s) => s.setShortcutsOpen);
  const t = getT(lang);

  return (
    <Overlay open={open} onOpenChange={setOpen} title={t.shortcutsTitle} dir={dirFor(lang)} className="!inset-x-4 !top-[10svh] !bottom-auto max-h-[80svh] !max-w-lg overflow-y-auto sm:!inset-y-auto sm:!top-[10svh]">
      <div className="flex items-center justify-between gap-4 p-6 pb-2">
        <h2 className="font-display text-title">{t.shortcutsTitle}</h2>
        <OverlayClose className="grid size-10 place-items-center rounded-full hover:bg-muted focus-visible:outline-2" aria-label={t.close}>
          <X className="size-5" aria-hidden />
        </OverlayClose>
      </div>
      <div className="space-y-6 p-6 pt-2">
        <Group title={t.shortcutsTitle} items={GLOBAL_SHORTCUTS} lang={lang} />
        <Group title={t.shortcutTabs} items={TAB_SHORTCUTS} lang={lang} />
      </div>
    </Overlay>
  );
}
