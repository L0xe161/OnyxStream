import { NextRequest, NextResponse } from "next/server";
import { BoundedCache } from "@/lib/server/bounded-cache";
import { MissingEnvError, requireEnv } from "@/lib/server/env";
import { convertSrtToVtt, decodeSubtitleBuffer } from "@/lib/subtitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBDL_API = "https://api.subdl.com/api/v1/subtitles";
const SUBDL_DOWNLOAD_HOST = "dl.subdl.com";
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024;
const MAX_SUBTITLE_BYTES = 4 * 1024 * 1024;
const EMPTY_VTT = "WEBVTT\n\n";

/** Friendly language code → SubDL language code. Also the request allow-list. */
const LANG_MAP: Readonly<Record<string, string>> = {
  ar: "AR", en: "EN", fr: "FR", es: "ES", de: "DE", tr: "TR", it: "IT",
  ru: "RU", pt: "PT", fa: "FA", ur: "UR", hi: "HI", id: "ID", ko: "KO",
};

const found = new BoundedCache<string>(200, 24 * 60 * 60_000);
const missing = new BoundedCache<string>(200, 60_000);

interface SubdlEntry {
  url?: string;
  language?: string;
}

interface SubdlResponse {
  subtitles?: SubdlEntry[];
  results?: SubdlEntry[];
}

function vttResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      // Third-party embed players on other origins load this track, so CORS must stay open.
      // The response is public subtitle text and carries no credentials.
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function fetchWithTimeout(url: string, ms: number, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, "User-Agent": "OnyxStream/1.0" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Reads a response body but stops once it exceeds `limit` bytes. */
async function readLimited(res: Response, limit: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > limit) throw new Error("Subtitle file too large");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > limit) throw new Error("Subtitle file too large");
  return buffer;
}

/** Accepts only a path on SubDL's download host; never an arbitrary URL. */
function resolveDownloadUrl(path: string): URL {
  const url = new URL(path, `https://${SUBDL_DOWNLOAD_HOST}`);
  if (url.protocol !== "https:" || url.hostname !== SUBDL_DOWNLOAD_HOST) {
    throw new Error("Unexpected subtitle host");
  }
  return url;
}

async function extractSubtitleText(buffer: Buffer, lang: string): Promise<string> {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isZip) return decodeSubtitleBuffer(buffer);

  const AdmZip = (await import("adm-zip")).default;
  const entries = new AdmZip(buffer)
    .getEntries()
    .filter((e) => !e.isDirectory && /\.(srt|vtt)$/i.test(e.entryName) && e.header.size <= MAX_SUBTITLE_BYTES);
  const entry = entries.find((e) => e.entryName.toLowerCase().includes(lang)) ?? entries[0];
  if (!entry) throw new Error("No subtitle file inside archive");
  return decodeSubtitleBuffer(entry.getData());
}

/**
 * GET /api/subtitles?tmdb_id=…&type=movie|tv&season=1&episode=1&lang=ar
 * Looks the title up on SubDL, converts SRT → WebVTT and serves it.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tmdbId = q.get("tmdb_id") ?? "";
  const type = q.get("type") === "tv" ? "tv" : "movie";
  const season = q.get("season") ?? "1";
  const episode = q.get("episode") ?? "1";
  const lang = (q.get("lang") ?? "ar").toLowerCase();

  const valid =
    /^[0-9]{1,9}$/.test(tmdbId) &&
    /^[0-9]{1,3}$/.test(season) &&
    /^[0-9]{1,4}$/.test(episode) &&
    lang in LANG_MAP;
  if (!valid) return vttResponse(EMPTY_VTT, 400);

  const cacheKey = `${tmdbId}-${type}-${season}-${episode}-${lang}`;
  const cached = found.get(cacheKey) ?? missing.get(cacheKey);
  if (cached !== undefined) return vttResponse(cached);

  let apiKey: string;
  try {
    apiKey = requireEnv("SUBDL_API_KEY");
  } catch (error) {
    if (error instanceof MissingEnvError) console.error(`[subtitles] ${error.message}`);
    return vttResponse(EMPTY_VTT, 503);
  }

  try {
    const search = new URLSearchParams({
      api_key: apiKey,
      tmdb_id: tmdbId,
      languages: LANG_MAP[lang],
      type,
    });
    if (type === "tv") {
      search.set("season_number", season);
      search.set("episode_number", episode);
    }

    const listing = await fetchWithTimeout(`${SUBDL_API}?${search.toString()}`, 7000, "application/json");
    if (!listing.ok) throw new Error(`SubDL query failed (${listing.status})`);

    const data = (await listing.json()) as SubdlResponse;
    const entries = data.subtitles ?? data.results ?? [];
    if (!Array.isArray(entries) || entries.length === 0) {
      found.set(cacheKey, EMPTY_VTT);
      return vttResponse(EMPTY_VTT);
    }

    const chosen = entries.find((s) => (s.language ?? "").toLowerCase().startsWith(lang)) ?? entries[0];
    if (!chosen.url) throw new Error("No download URL in SubDL response");

    const file = await fetchWithTimeout(resolveDownloadUrl(chosen.url).toString(), 9000, "*/*");
    if (!file.ok) throw new Error(`Subtitle download failed (${file.status})`);

    const text = await extractSubtitleText(await readLimited(file, MAX_DOWNLOAD_BYTES), lang);
    const vtt = convertSrtToVtt(text);
    found.set(cacheKey, vtt);
    return vttResponse(vtt);
  } catch (error) {
    console.warn("[subtitles]", error instanceof Error ? error.message : "Unknown error");
    missing.set(cacheKey, EMPTY_VTT);
    return vttResponse(EMPTY_VTT);
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
