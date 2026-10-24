"use client";

import { useCallback, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "poster" | "backdrop" | "profile" | "still";

/** TMDB serves fixed width buckets; each kind uses the ladder that fits its use. */
const LADDER: Record<Kind, readonly number[]> = {
  poster: [185, 342, 500, 780],
  backdrop: [780, 1280],
  profile: [185, 342],
  still: [185, 300, 500],
};
const ASPECT: Record<Kind, string> = {
  poster: "2 / 3",
  backdrop: "16 / 9",
  profile: "2 / 3",
  still: "16 / 9",
};
const TMDB = "https://image.tmdb.org/t/p";
const sizeName = (w: number) => (w === 300 ? "w300" : `w${w}`);

interface TmdbImageProps {
  path: string | null | undefined;
  kind: Kind;
  alt: string;
  /** Standard `sizes` attribute: tells the browser which width it will render at. */
  sizes: string;
  /** Only for the single largest above-the-fold image. */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /** Hide from assistive tech when a sibling already names the item. */
  decorative?: boolean;
}

/**
 * Responsive artwork with a reserved aspect ratio (no layout shift), a tonal
 * placeholder that fades to the image, and a designed fallback when a title
 * has no artwork or the request fails.
 */
export function TmdbImage({ path, kind, alt, sizes, priority = false, className, imgClassName, decorative = false }: TmdbImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const ladder = LADDER[kind];
  const widest = ladder[ladder.length - 1];

  // Cached images can finish before React attaches onLoad. A ref callback
  // checks complete-on-mount, and the onLoad handler covers fresh loads.
  const setImgRef = useCallback((node: HTMLImageElement | null) => {
    ref.current = node;
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const showFallback = !path || failed;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} style={{ aspectRatio: ASPECT[kind] }}>
      {showFallback ? (
        <div className="absolute inset-0 grid place-items-center p-3 text-center text-muted-foreground" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : alt}>
          <div className="flex flex-col items-center gap-2">
            <ImageOff className="size-5 opacity-70" aria-hidden />
            <span className="font-display line-clamp-3 text-sm leading-tight" dir="auto" aria-hidden>
              {alt}
            </span>
          </div>
        </div>
      ) : (
        <img
          ref={setImgRef}
          src={`${TMDB}/${sizeName(ladder[Math.min(1, ladder.length - 1)])}${path}`}
          srcSet={ladder.map((w) => `${TMDB}/${sizeName(w)}${path} ${w}w`).join(", ")}
          sizes={sizes}
          width={widest}
          height={Math.round(widest * (kind === "poster" || kind === "profile" ? 1.5 : 0.5625))}
          alt={decorative ? "" : alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      )}
    </div>
  );
}
