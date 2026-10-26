import { NextResponse } from "next/server";
import { translateText } from "@/lib/server/translate";
import type { Language } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 1000;

/**
 * Machine-translates a short string (a movie tagline) to the target language
 * using the z-ai-web-dev-sdk LLM. Used by the media modal's `useLocalizedTagline`
 * hook so a tagline with no TMDB translation still appears in Persian/Arabic
 * instead of being hidden or shown in English.
 *
 *   GET /api/translate?text=Believe+in+the+Hail+Mary.&to=fa
 *   → { "translated": "به هیل مری باور کن." }
 *
 * Bad input (missing/over-long text, unknown target) returns 400 without
 * calling the LLM; an LLM failure returns the original text with a 200 so the
 * client can fall back gracefully.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (!text.trim()) {
    return NextResponse.json(
      { error: "Missing 'text' parameter" },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: "Text too long" },
      { status: 400 }
    );
  }
  if (to !== "fa" && to !== "ar" && to !== "en") {
    return NextResponse.json(
      { error: "Unsupported target language" },
      { status: 400 }
    );
  }

  const translated = await translateText(text, to as Language);
  return NextResponse.json(
    { translated, source: text, to },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
