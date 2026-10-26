"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Overlay, OverlayClose } from "./overlay";
import { Field, Section, Segmented } from "./settings-controls";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOnyxStore } from "@/lib/store";
import { useEffectiveTheme } from "@/hooks/use-effective-theme";
import { ACCENTS, accentContrast, resolveAccent } from "@/lib/themes";
import { dirFor, getT, LANGUAGES } from "@/lib/i18n";
import { buildExport, parseImport } from "@/lib/data-transfer";
import { cn } from "@/lib/utils";
import type { AccentColor } from "@/lib/themes";
import type { Language } from "@/lib/types";
import type { Settings } from "@/lib/settings";

type Confirm = "history" | "all" | null;

export function SettingsSheet({ lang }: { lang: Language }) {
  const open = useOnyxStore((s) => s.settingsOpen);
  const setOpen = useOnyxStore((s) => s.setSettingsOpen);
  const settings = useOnyxStore((s) => s.settings);
  const update = useOnyxStore((s) => s.updateSettings);
  const reset = useOnyxStore((s) => s.resetSettings);
  const effectiveTheme = useEffectiveTheme();
  const accent = useOnyxStore((s) => s.accent);
  const setAccent = useOnyxStore((s) => s.setAccent);
  const bilingual = useOnyxStore((s) => s.bilingual);
  const t = getT(lang);

  // Contrast report for the selected accent in the active theme, so the
  // picker tells the user when a colour will be adjusted for legibility.
  const resolved = resolveAccent(ACCENTS.find((a) => a.id === accent)?.color ?? "#fff", effectiveTheme);
  const ratio = accentContrast(effectiveTheme, ACCENTS.find((a) => a.id === accent)?.color ?? "#fff");

  const [confirm, setConfirm] = useState<Confirm>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => update({ [key]: value } as Partial<Settings>);
  const store = () => useOnyxStore.getState();

  const exportData = () => {
    const blob = new Blob([JSON.stringify(buildExport(store()), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `onyxstream-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File | undefined) => {
    if (!file) return;
    const parsed = file.size < 5_000_000 ? parseImport(await file.text()) : null;
    if (!parsed) {
      toast.error(t.dataImportFailed);
      return;
    }
    store().importData(parsed);
    toast.success(t.dataImported);
  };

  const runConfirmed = () => {
    if (confirm === "history") store().clearContinueWatching();
    if (confirm === "all") store().resetAll();
    setConfirm(null);
    toast(t.cleared);
  };

  return (
    <>
      <Overlay open={open} onOpenChange={setOpen} title={t.settingsTitle} description={t.settingsSub} variant="sheet" dir={dirFor(lang)}>
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="font-display text-headline !text-[2rem]">{t.settingsTitle}</h2>
            <p className="mt-1 text-meta text-muted-foreground">{t.settingsSub}</p>
          </div>
          <OverlayClose className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-2" aria-label={t.close}>
            <X className="size-5" aria-hidden />
          </OverlayClose>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8">
          <Section title={t.secLanguage}>
            <Field label={t.setInterfaceLang} hint={t.setInterfaceLangHint}>
              <Segmented label={t.setInterfaceLang} value={lang} onChange={(v) => v !== lang && store().setLang(v)} options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))} />
            </Field>
            <Field label={t.setBilingual} hint={t.setBilingualHint}>
              <Switch checked={bilingual} onCheckedChange={(v) => store().setBilingual(v)} aria-label={t.setBilingual} />
            </Field>
          </Section>

          <Section title={t.secAppearance}>
            <Field label={t.setAccent} hint={resolved.adjusted ? t.accentAdjusted : undefined} stacked>
              <div role="radiogroup" aria-label={t.setAccent} className="flex flex-wrap gap-2">
                {ACCENTS.map((a) => {
                  const selected = a.id === accent;
                  const passes = accentContrast(effectiveTheme, a.color) >= 4.5;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${lang === "ar" ? a.labelAr : a.label}${passes ? "" : ` · ${t.accentAdjusted}`}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setAccent(a.id as AccentColor)}
                      className={cn(
                        "relative size-10 rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                        selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "ring-1 ring-black/10 dark:ring-white/10"
                      )}
                      style={{ background: a.color }}
                    >
                      {!passes && (
                        <span className="absolute -bottom-0.5 -end-0.5 grid size-4 place-items-center rounded-full bg-background text-[8px] leading-none text-muted-foreground" aria-hidden>!</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-meta text-muted-foreground tabular-nums">
                {lang === "ar" ? (ACCENTS.find((a) => a.id === accent)?.labelAr ?? "") : (ACCENTS.find((a) => a.id === accent)?.label ?? "")}
                {" · "}
                {t.contrastRatio.replace("{n}", ratio.toFixed(1))}
              </p>
            </Field>

            <Field label={t.setCorners}>
              <Segmented label={t.setCorners} value={settings.corners} onChange={set("corners")} options={[{ value: "sharp", label: t.cornersSharp }, { value: "soft", label: t.cornersSoft }, { value: "round", label: t.cornersRound }]} />
            </Field>
            <Field label={t.setDensity} stacked>
              <Segmented label={t.setDensity} value={settings.density} onChange={set("density")} options={[{ value: "compact", label: t.densityCompact }, { value: "comfortable", label: t.densityComfortable }, { value: "spacious", label: t.densitySpacious }]} />
            </Field>
          </Section>

          <Section title={t.secLayout}>
            <Field label={t.setPosterSize}>
              <Segmented label={t.setPosterSize} value={settings.posterSize} onChange={set("posterSize")} options={[{ value: "sm", label: t.sizeSmall }, { value: "md", label: t.sizeMedium }, { value: "lg", label: t.sizeLarge }]} />
            </Field>
            <Field label={t.setBrowseLayout}>
              <Segmented label={t.setBrowseLayout} value={settings.browseLayout} onChange={set("browseLayout")} options={[{ value: "rows", label: t.layoutRows }, { value: "grid", label: t.layoutGrid }]} />
            </Field>
            <Field label={t.setHero}>
              <Switch checked={settings.heroEnabled} onCheckedChange={set("heroEnabled")} aria-label={t.setHero} />
            </Field>
          </Section>

          <Section title={t.secMotion}>
            <Field label={t.setMotion} hint={t.motionHint} stacked>
              <Segmented label={t.setMotion} value={settings.motion} onChange={set("motion")} options={[{ value: "system", label: t.motionSystem }, { value: "full", label: t.motionFull }, { value: "reduced", label: t.motionReduced }, { value: "off", label: t.motionOff }]} />
            </Field>
            <Field label={t.setHeroAutoplay}>
              <Switch checked={settings.heroAutoplay} onCheckedChange={set("heroAutoplay")} aria-label={t.setHeroAutoplay} />
            </Field>
            <Field label={t.setHeroInterval}>
              <Segmented label={t.setHeroInterval} value={settings.heroIntervalMs} onChange={set("heroIntervalMs")} options={[{ value: 6000, label: "6" }, { value: 8000, label: "8" }, { value: 12000, label: "12" }]} />
            </Field>
          </Section>

          <Section title={t.secPlayback}>
            <Field label={t.setResume} stacked>
              <Segmented label={t.setResume} value={settings.resume} onChange={set("resume")} options={[{ value: "ask", label: t.resumeAsk }, { value: "always", label: t.resumeAlways }, { value: "never", label: t.resumeNever }]} />
            </Field>
          </Section>

          <Section title={t.secContent}>
            <Field label={t.setHideAdult}>
              <Switch checked={settings.hideAdult} onCheckedChange={set("hideAdult")} aria-label={t.setHideAdult} />
            </Field>
          </Section>

          <Section title={t.secData}>
            <Field label={t.dataExport} hint={t.dataExportHint}>
              <button type="button" onClick={exportData} className="inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium hover:bg-secondary focus-visible:outline-2"><Download className="size-4" aria-hidden />{t.dataExport}</button>
            </Field>
            <Field label={t.dataImport}>
              <>
                <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => { void importData(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium hover:bg-secondary focus-visible:outline-2"><Upload className="size-4" aria-hidden />{t.dataImport}</button>
              </>
            </Field>
            <Field label={t.clearHistory}>
              <button type="button" onClick={() => setConfirm("history")} className="h-10 rounded-full bg-muted px-4 text-sm font-medium hover:bg-secondary focus-visible:outline-2">{t.clearHistory}</button>
            </Field>
            <Field label={t.clearAll}>
              <button type="button" onClick={() => setConfirm("all")} className="h-10 rounded-full bg-[var(--destructive)] px-4 text-sm font-semibold text-background hover:brightness-110 focus-visible:outline-2">{t.clearAll}</button>
            </Field>
          </Section>

          <Section title={t.secKeyboard}>
            <Field label={t.shortcutsTitle} hint={t.shortcutPalette + " · ⌘/Ctrl K"}>
              <button type="button" onClick={() => { setOpen(false); store().setShortcutsOpen(true); }} className="h-10 rounded-full bg-muted px-4 text-sm font-medium hover:bg-secondary focus-visible:outline-2">?</button>
            </Field>
          </Section>
        </div>

        <footer className="shrink-0 bg-card px-6 py-4">
          <button type="button" onClick={() => { reset(); toast(t.resetDone); }} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-muted text-sm font-semibold hover:bg-secondary focus-visible:outline-2">
            <RotateCcw className="size-4" aria-hidden />
            {t.resetDefaults}
          </button>
        </footer>
      </Overlay>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir={dirFor(lang)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "all" ? t.confirmClearAll : t.confirmClearHistory}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmIrreversible}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>{t.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
