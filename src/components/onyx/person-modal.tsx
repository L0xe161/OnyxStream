"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { Overlay, OverlayClose } from "./overlay";
import { MediaCard } from "./media-card";
import { TmdbImage } from "./tmdb-image";
import { useOnyxStore } from "@/lib/store";
import { usePerson } from "@/hooks/use-tmdb";
import { dirFor, getT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Language, TMDBMediaItem, TMDBPerson, TMDBPersonCastCredit, TMDBPersonCrewCredit } from "@/lib/types";

interface PersonModalProps {
  lang: Language;
  bilingual: boolean;
  onPlay: (media: TMDBMediaItem) => void;
  onSelectDetails: (media: TMDBMediaItem) => void;
}

type Credit = TMDBPersonCastCredit | TMDBPersonCrewCredit;
const PAGE = 12;

const creditYear = (c: Credit) => (c.release_date || c.first_air_date || "").slice(0, 4);
const newestFirst = (a: Credit, b: Credit) => creditYear(b).localeCompare(creditYear(a));

export function PersonModal({ lang, bilingual, onPlay, onSelectDetails }: PersonModalProps) {
  const t = getT(lang);
  const seed = useOnyxStore((s) => s.activePerson);
  const setActivePerson = useOnyxStore((s) => s.setActivePerson);
  // The person "seed" can come from search (TMDBSearchPersonResult shape) or
  // from a director credit / URL restore (full TMDBPerson). Both satisfy the
  // TMDBPerson shape we read here. We hold the last seed so the body stays
  // mounted (and keyed) during the overlay's exit animation — this is the
  // React-blessed "adjust state during render" pattern, not an effect.
  const [held, setHeld] = useState<TMDBPerson | null>(seed);
  if (seed && seed !== held) setHeld(seed);

  return (
    <Overlay open={!!seed} onOpenChange={(o) => !o && setActivePerson(null)} title={held?.name ?? t.selectPerson} variant="modal" dir={dirFor(lang)}>
      {held && <PersonBody key={held.id} seed={held} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} />}
    </Overlay>
  );
}

function PersonBody({ seed, lang, bilingual, onPlay, onSelectDetails }: PersonModalProps & { seed: TMDBPerson }) {
  const t = getT(lang);
  const artworkLang = useOnyxStore((s) => s.artworkLang);
  // Open on the credits that match how the person was reached: an actor lands
  // on "Acted in", a director (or creator) lands on "Directed".
  const [tab, setTab] = useState<"directed" | "acted">(
    seed.known_for_department === "Acting" ? "acted" : "directed"
  );
  const [expanded, setExpanded] = useState(false);
  const { person, credits, loading } = usePerson(seed, lang, artworkLang);

  const name = person?.name || seed.name;
  const directed = (credits?.crew ?? []).filter((c) => c.job === "Director").sort(newestFirst);
  const acted = (credits?.cast ?? []).slice().sort(newestFirst);
  const list = tab === "directed" ? directed : acted;
  const visible = expanded ? list : list.slice(0, PAGE);

  const tabs = [
    { id: "directed" as const, label: t.directed, count: directed.length },
    { id: "acted" as const, label: t.actedIn, count: acted.length },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OverlayClose className="absolute end-4 top-4 z-20 grid size-11 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white" aria-label={t.close}>
        <X className="size-5" aria-hidden />
      </OverlayClose>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header className="flex flex-col items-center gap-6 px-6 pb-8 pt-12 text-center sm:flex-row sm:items-end sm:px-10 sm:text-start">
          <TmdbImage path={person?.profile_path || seed.profile_path} kind="profile" alt={name} decorative sizes="10rem" className="w-36 shrink-0 rounded-[var(--radius-lg)] sm:w-44" />
          <div className="min-w-0 space-y-3">
            {person?.known_for_department && <p className="text-meta text-muted-foreground">{person.known_for_department}</p>}
            <h2 className="font-display text-[clamp(2rem,1.4rem+3vw,3.75rem)] font-medium leading-[0.98] tracking-[-0.035em] text-balance" dir="auto">{name}</h2>
            {person?.birthday && (
              <p className="flex items-center justify-center gap-2 text-muted-foreground tabular-nums sm:justify-start">
                <Calendar className="size-4 shrink-0" aria-hidden />
                <span dir="auto">
                  {t.born} {person.birthday}
                  {person.place_of_birth ? ` ${t.in} ${person.place_of_birth}` : ""}
                  {person.deathday ? ` · ✝ ${person.deathday}` : ""}
                </span>
              </p>
            )}
          </div>
        </header>

        <div className="space-y-8 px-6 pb-10 sm:px-10">
          {person?.biography && <p className="max-w-2xl text-body" dir="auto">{person.biography}</p>}

          {loading && (
            <p role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t.loadingFilmography}
            </p>
          )}

          {credits && !loading && (
            <section>
              <div role="tablist" aria-label={name} className="mb-6 inline-flex gap-1 rounded-full bg-muted p-1">
                {tabs.map((x) => (
                  <button key={x.id} type="button" role="tab" id={`person-tab-${x.id}`} aria-selected={tab === x.id} aria-controls="person-panel" tabIndex={tab === x.id ? 0 : -1} onClick={() => { setTab(x.id); setExpanded(false); }} className={cn("h-9 rounded-full px-4 text-sm font-medium tabular-nums transition-colors focus-visible:outline-2", tab === x.id ? "bg-foreground text-background" : "text-foreground/80 hover:text-foreground")}>
                    {x.label} ({x.count})
                  </button>
                ))}
              </div>

              <div id="person-panel" role="tabpanel" aria-labelledby={`person-tab-${tab}`}>
                {list.length === 0 ? (
                  <p className="text-muted-foreground">—</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-8">
                    {visible.map((c) => {
                      const media: TMDBMediaItem = {
                        id: c.id, title: c.title, name: c.name, original_title: c.original_title, original_name: c.original_name,
                        poster_path: c.poster_path, backdrop_path: c.backdrop_path, release_date: c.release_date, first_air_date: c.first_air_date,
                        vote_average: c.vote_average ?? 0, vote_count: 0, overview: "", media_type: c.media_type,
                      };
                      return (
                        <div key={`${c.id}-${"credit_id" in c ? c.credit_id : c.title || c.name}`}>
                          <MediaCard media={media} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} />
                          {"character" in c && c.character && <p className="mt-0.5 line-clamp-1 text-meta text-muted-foreground" dir="auto">{t.asCharacter} {c.character}</p>}
                          {"job" in c && c.job && <p className="mt-0.5 line-clamp-1 text-meta text-muted-foreground">{c.job}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {list.length > PAGE && (
                  <button type="button" onClick={() => setExpanded((v) => !v)} className="mx-auto mt-8 flex h-11 items-center gap-2 rounded-full bg-muted px-5 text-sm font-medium hover:bg-secondary focus-visible:outline-2">
                    {expanded ? <><ChevronUp className="size-4" aria-hidden />{t.showLess}</> : <><ChevronDown className="size-4" aria-hidden />{t.viewAllCredits} ({list.length})</>}
                  </button>
                )}
              </div>
            </section>
          )}

          {seed.known_for && seed.known_for.length > 0 && !loading && (
            <section aria-label={t.knownFor}>
              <h3 className="mb-4 font-display text-title">{t.knownFor}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-8">
                {seed.known_for.slice(0, 4).map((m) => <MediaCard key={m.id} media={m} lang={lang} bilingual={bilingual} onPlay={onPlay} onSelectDetails={onSelectDetails} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
