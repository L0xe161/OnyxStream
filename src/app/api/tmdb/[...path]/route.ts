import { NextRequest, NextResponse } from "next/server";
import { BoundedCache } from "@/lib/server/bounded-cache";
import { MissingEnvError, requireEnv } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const ID = "[0-9]{1,9}";

/** Only these TMDB endpoints are reachable through the proxy. */
const ENDPOINTS: readonly RegExp[] = [
  /^trending\/all\/(day|week)$/,
  /^(movie|tv)\/(popular|top_rated)$/,
  /^movie\/(upcoming|now_playing)$/,
  /^discover\/(movie|tv)$/,
  /^search\/(multi|person|movie|tv)$/,
  /^genre\/(movie|tv)\/list$/,
  new RegExp(`^(movie|tv)/${ID}$`),
  new RegExp(`^(movie|tv)/${ID}/images$`),
  new RegExp(`^tv/${ID}/season/[0-9]{1,3}$`),
  new RegExp(`^person/${ID}$`),
  new RegExp(`^person/${ID}/combined_credits$`),
];

const APPEND_VALUES = new Set([
  "credits", "videos", "images", "similar", "recommendations",
  "external_ids", "release_dates", "content_ratings", "watch/providers",
  "movie_credits", "tv_credits", "combined_credits",
]);
const SORT_VALUES = /^(popularity|vote_average|vote_count|primary_release_date|first_air_date|release_date|revenue|title|name)\.(asc|desc)$/;

const isDate = (v: string) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v);

/** Every accepted query parameter and the shape its value must have. */
const PARAMS: Record<string, (v: string) => boolean> = {
  language: (v) => /^[a-z]{2}(-[A-Z]{2})?$/.test(v),
  include_image_language: (v) => /^[a-z]{2}(,([a-z]{2}|null))*$|^null$/.test(v),
  page: (v) => /^[1-9][0-9]{0,2}$/.test(v),
  query: (v) => v.length > 0 && v.length <= 100,
  with_genres: (v) => /^[0-9]{1,5}([,|][0-9]{1,5}){0,9}$/.test(v),
  with_original_language: (v) => /^[a-z]{2}$/.test(v),
  without_original_language: (v) => /^[a-z]{2}$/.test(v),
  region: (v) => /^[A-Z]{2}$/.test(v),
  sort_by: (v) => SORT_VALUES.test(v),
  "primary_release_date.gte": isDate,
  "primary_release_date.lte": isDate,
  "first_air_date.gte": isDate,
  "first_air_date.lte": isDate,
  "vote_count.gte": (v) => /^[0-9]{1,6}$/.test(v),
  "vote_average.gte": (v) => /^(10|[0-9])(\.[0-9])?$/.test(v),
  include_adult: (v) => v === "true" || v === "false",
  append_to_response: (v) => v.split(",").every((x) => APPEND_VALUES.has(x)),
};

const cache = new BoundedCache<unknown>(300, 5 * 60_000);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const endpoint = path.join("/");

  if (!ENDPOINTS.some((pattern) => pattern.test(endpoint))) {
    return badRequest("Unsupported endpoint");
  }

  const query = new URLSearchParams();
  for (const [key, value] of req.nextUrl.searchParams) {
    const valid = PARAMS[key];
    if (!valid) return badRequest(`Unsupported parameter: ${key}`);
    if (!valid(value)) return badRequest(`Invalid value for ${key}`);
    query.set(key, value);
  }
  query.sort();

  const cacheKey = `${endpoint}?${query.toString()}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) {
    return NextResponse.json(hit, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "HIT",
      },
    });
  }

  let apiKey: string;
  try {
    apiKey = requireEnv("TMDB_API_KEY");
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`[tmdb] ${error.message}`);
      return NextResponse.json({ error: "Service is not configured" }, { status: 503 });
    }
    throw error;
  }

  const upstream = new URLSearchParams(query);
  upstream.set("api_key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${TMDB_BASE}/${endpoint}?${upstream.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "OnyxStream/1.0" },
    });
    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream request failed" },
        { status: res.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    cache.set(cacheKey, body);
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "MISS",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach TMDB" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
