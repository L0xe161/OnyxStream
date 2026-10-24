"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Overlay, OverlayClose } from "./overlay";
import { Field, Section, Segmented } from "./settings-controls";
import { SortableList } from "./settings-sortable";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOnyxStore } from "@/lib/store";
import { useEffectiveTheme } from "@/hooks/use-effective-theme";
import { ACCENTS, accentContrast, resolveAccent } from "@/lib/themes";
import { dirFor, getT, type TranslationKey } from "@/lib/i18n";
import { STREAM_SERVERS } from "@/lib/stream-servers";
import { TAB_DEFINITIONS } from "@/lib/tabs";
import { buildExport, parseImport } from "@/lib/data-transfer";
import { cn } from "@/lib/utils";
import type { HomeRowId, HomeRowSetting, Settings, SubtitleChoice, TabSetting } from "@/lib/settings";
import type { AccentColor } from "@/lib/themes";
import type { Language } from "@/lib/types";

const ROW_LABELS: Record<HomeRowId, TranslationKey> = {
  continue: "continueWatching",
  trending: "trendingToday",
  movies: "popularMovies",
  tv: "popularSeries",
  anime: "topAnime",
  cartoons: "classicCartoons",
  topMovies: "topRatedMovies",
  topTV: "topRatedTV",
  upcoming: "upcoming",
  genres: "genres",
};

const SUBTITLES: SubtitleChoice[] = ["off", "ar", "en", "fr", "es", "de", "tr"];
const ORIGINAL_LANGUAGES = ["en", "ar", "ja", "ko", "fr", "es", "tr", "hi", "zh"];
/** ISO-3166-1 regions surfaced in content preferences; codes TMDB accepts. */
const PREFERRED_REGIONS = [
  { code: "US", en: "United States", ar: "الولايات المتحدة" },
  { code: "GB", en: "United Kingdom", ar: "المملكة المتحدة" },
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات" },
  { code: "SA", en: "Saudi Arabia", ar: "السعودية" },
  { code: "EG", en: "Egypt", ar: "مصر" },
  { code: "FR", en: "France", ar: "فرنسا" },
  { code: "DE", en: "Germany", ar: "ألمانيا" },
  { code: "JP", en: "Japan", ar: "اليابان" },
  { code: "KR", en: "South Korea", ar: "كوريا الجنوبية" },
  { code: "IN", en: "India", ar: "الهند" },
  { code: "TR", en: "Türkiye", ar: "تركيا" },
  { code: "BR", en: "Brazil", ar: "البرازيل" },
] as const;

type Confirm = "history" | "all" | null;

export function SettingsSheet({ lang }: { lang: Language }) {
  const open = useOnyxStore((s) => s.settingsOpen);
  const setOpen = useOnyxStore((s) => s.setSettingsOpen);
  const settings = useOnyxStore((s) => s.settings);
  const update = useOnyxStore((s) => s.updateSettings);
  const reset = useOnyxStore((s) => s.resetSettings);
  const theme = useOnyxStore((s) => s.theme);
  const effectiveTheme = useEffectiveTheme();
  const accent = useOnyxStore((s) => s.accent);
  const setAccent = useOnyxStore((s) => s.setAccent);
  const bilingual = useOnyxStore((s) => s.bilingual);
  const serverId = useOnyxStore((s) => s.activeServerId);
  const t = getT(lang);
  const names = new Intl.DisplayNames([lang], { type: "language" });

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
          <Section title={t.secAppearance}>
            <Field label={t.setTheme} stacked>
              <Segmented
                label={t.setTheme}
                value={settings.followSystemTheme ? "system" : theme}
                options={[{ value: "dark", label: t.themeDark }, { value: "light", label: t.themeLight }, { value: "frosted", label: t.themeFrosted }, { value: "system", label: t.themeSystem }]}
                onChange={(v) => {
                  if (v === "system") update({ followSystemTheme: true });
                  else {
                    update({ followSystemTheme: false });
                    store().setTheme(v);
                  }
                }}
              />
            </Field>

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
            <Field label={t.setTextSize}>
              <Segmented label={t.setTextSize} value={settings.textScale} onChange={set("textScale")} options={[{ value: 90, label: "90%" }, { value: 100, label: "100%" }, { value: 112, label: "112%" }, { value: 125, label: "125%" }]} />
            </Field>
            <Field label={t.setFont}>
              <Segmented label={t.setFont} value={settings.fontStyle} onChange={set("fontStyle")} options={[{ value: "editorial", label: t.fontEditorial }, { value: "neutral", label: t.fontNeutral }]} />
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
            <Field label={t.setHomeRows} hint={t.setHomeRowsHint} stacked>
              <SortableList<HomeRowSetting> items={settings.homeRows} labelFor={(id) => t[ROW_LABELS[id]]} labels={{ drag: t.dragHandle, up: t.moveUp, down: t.moveDown }} onChange={set("homeRows")} />
            </Field>
            <Field label={t.setTabs} hint={t.setTabsHint} stacked>
              <SortableList<TabSetting> items={settings.tabs} labelFor={(id) => t[TAB_DEFINITIONS.find((d) => d.id === id)?.labelKey ?? "navAll"]} labels={{ drag: t.dragHandle, up: t.moveUp, down: t.moveDown }} onChange={set("tabs")} />
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

          <Section title={t.secLanguage}>
            <Field label={t.setInterfaceLang} hint={t.setInterfaceLangHint}>
              <Segmented label={t.setInterfaceLang} value={lang} onChange={(v) => v !== lang && store().toggleLang()} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />
            </Field>
            <Field label={t.setBilingual} hint={t.setBilingualHint}>
              <Switch checked={bilingual} onCheckedChange={(v) => store().setBilingual(v)} aria-label={t.setBilingual} />
            </Field>
            <Field label={t.setSubtitleLang} stacked>
              <Segmented label={t.setSubtitleLang} value={settings.subtitleLang} onChange={set("subtitleLang")} options={SUBTITLES.map((c) => ({ value: c, label: c === "off" ? t.subtitlesOff : names.of(c) ?? c }))} />
            </Field>
          </Section>

          <Section title={t.secPlayback}>
            <Field label={t.setDefaultServer}>
              <select value={serverId} onChange={(e) => store().setActiveServerId(e.target.value)} aria-label={t.setDefaultServer} className="h-10 rounded-full bg-muted px-4 text-sm outline-none focus-visible:outline-2">
                {STREAM_SERVERS.map((s) => <option key={s.id} value={s.id}>{lang === "ar" ? s.nameAr : s.name}</option>)}
              </select>
            </Field>
            <Field label={t.setAutoFallback} hint={t.setAutoFallbackHint}>
              <Switch checked={settings.autoFallback} onCheckedChange={set("autoFallback")} aria-label={t.setAutoFallback} />
            </Field>
            <Field label={t.setAutoNext}>
              <Switch checked={settings.autoPlayNext} onCheckedChange={set("autoPlayNext")} aria-label={t.setAutoNext} />
            </Field>
            <Field label={t.setRememberSub}>
              <Switch checked={settings.rememberSubtitle} onCheckedChange={set("rememberSubtitle")} aria-label={t.setRememberSub} />
            </Field>
            <Field label={t.setResume} stacked>
              <Segmented label={t.setResume} value={settings.resume} onChange={set("resume")} options={[{ value: "ask", label: t.resumeAsk }, { value: "always", label: t.resumeAlways }, { value: "never", label: t.resumeNever }]} />
            </Field>
          </Section>

          <Section title={t.secContent}>
            <Field label={t.setHideWatched}>
              <Switch checked={settings.hideWatched} onCheckedChange={set("hideWatched")} aria-label={t.setHideWatched} />
            </Field>
            <Field label={t.setHideAdult}>
              <Switch checked={settings.hideAdult} onCheckedChange={set("hideAdult")} aria-label={t.setHideAdult} />
            </Field>
            <Field label={t.setOriginalLangs} hint={t.setOriginalLangsHint} stacked>
              <div className="flex flex-wrap gap-2">
                {ORIGINAL_LANGUAGES.map((code) => {
                  const on = settings.originalLanguages.includes(code);
                  return (
                    <button key={code} type="button" aria-pressed={on} onClick={() => update({ originalLanguages: on ? settings.originalLanguages.filter((c) => c !== code) : [...settings.originalLanguages, code] })} className={cn("h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2", on ? "bg-foreground text-background" : "bg-muted text-foreground/80 hover:text-foreground")}>
                      {names.of(code) ?? code}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t.setPreferredRegions} hint={t.setPreferredRegionsHint} stacked>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_REGIONS.map((r) => {
                  const on = settings.preferredRegions.includes(r.code);
                  return (
                    <button key={r.code} type="button" aria-pressed={on} onClick={() => update({ preferredRegions: on ? settings.preferredRegions.filter((c) => c !== r.code) : [...settings.preferredRegions, r.code] })} className={cn("h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2", on ? "bg-foreground text-background" : "bg-muted text-foreground/80 hover:text-foreground")}>
                      {lang === "ar" ? r.ar : r.en}
                    </button>
                  );
                })}
              </div>
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
