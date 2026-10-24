# CineSolace (package: `moviejoy`)

A bilingual (English / Arabic, full RTL) streaming browser built on Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui + Radix, Zustand, Framer Motion and TanStack Query.

## Run

```bash
cp .env.example .env.local      # then fill in TMDB_API_KEY and SUBDL_API_KEY
npm install
npm run dev
```

The app refuses to serve TMDB or subtitle data without those two server-side keys (it returns a clear server-side error naming the missing variable). Keys are never sent to the browser — the TMDB proxy injects the server key itself and only accepts an allow-list of endpoints and parameters.

**If you cloned this from the original `soonwatch.tar`, rotate both API keys now** — they were committed in the archive. See "Security" below.

## Structure

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Data-driven tab views, animated tab transitions, scroll restoration |
| `src/app/api/tmdb/[...path]` | TMDB proxy: endpoint + parameter allow-list, bounded LRU cache, server-only key |
| `src/app/api/subtitles` | SubDL → WebVTT proxy: validated input, host allow-list, size caps, zip extraction |
| `src/components/onyx/overlay.tsx` | The one accessible dialog shell (Radix) used by every overlay — role/aria-modal/focus trap/restore/Escape |
| `src/components/onyx/settings-sheet.tsx` | Settings & personalization (appearance, layout, motion, language, playback, content, data, keyboard) |
| `src/components/onyx/unified-player.tsx` | Theater player: real TMDB seasons/episodes, server fallback, sandboxed iframe, auto-advance |
| `src/hooks/use-playback.ts` | Seasons, server fallback, progress tracking, continue-watching persistence |
| `src/hooks/use-url-sync.ts` + `src/lib/url-state.ts` | Back button, refresh and shareable deep links |
| `src/lib/motion.ts` | Shared motion tokens (durations, easings, distances) |
| `src/lib/themes.ts`, `src/lib/color.ts` | 9 contrast-guaranteed accents per theme |
| `src/lib/store.ts` | Persisted state, versioned migration (`STORE_VERSION = 4`) |
| `next.config.ts` | CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers |

## Persisted data

State lives in `localStorage` under `onyx-store-v3` (key kept so existing users keep their data). `STORE_VERSION` is 4; `sanitizePersisted` upgrades any older shape, de-duplicates Continue Watching, clamps progress, and fills new settings with defaults. Users can export/import everything as JSON from Settings → Data & privacy, with a confirmation before clearing.

## Deep links

`?tab=catalog&type=tv&genres=18,80&rating=7.5` · `?title=tv-1396` · `?play=tv-1396&s=2&e=5&srv=vidlink` · `?person=525` · `?q=matrix`

## Security

- **No hard-coded API keys.** `requireEnv()` reads `TMDB_API_KEY` and `SUBDL_API_KEY` from the environment only; there are no fallbacks. A missing key fails loudly server-side.
- **TMDB proxy is an allow-list**, not an open relay. Only the endpoints the app needs are reachable; every query parameter is validated by shape; the server key is injected, never client-supplied.
- **Bounded caches** (`BoundedCache`) with a max-entries cap, TTL and LRU eviction — no unbounded memory growth. `Cache-Control` / `stale-while-revalidate` headers set on responses.
- **Player iframe is sandboxed** (`allow-scripts allow-same-origin allow-presentation allow-forms` — no top-navigation, no popups) with `referrerPolicy="origin"`.
- **Security headers** set in `next.config.ts`: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- `typescript.ignoreBuildErrors` is **removed** — type errors fail the build.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Third-party embed providers are not operated by this project; confirm their terms and your local law before deploying publicly.

