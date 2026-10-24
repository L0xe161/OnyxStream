import type { MediaType } from "./types";

export interface StreamParams {
  tmdbId: number | string;
  type: MediaType;
  season?: number;
  episode?: number;
  subtitleVttUrl?: string; // Absolute/proxy URL to a WebVTT file
  subtitleLabel?: string;
}

export interface StreamServerOption {
  id: string;
  name: string;
  nameAr: string;
  supportsSubtitles: boolean;
  priority: number;
  description: string;
  descriptionAr: string;
}

export const STREAM_SERVERS: StreamServerOption[] = [
  {
    id: "embedmaster",
    name: "EmbedMaster Onyx",
    nameAr: "إمبيد ماستر",
    supportsSubtitles: true,
    priority: 1,
    description: "Onyx skin with injected Arabic subs",
    descriptionAr: "واجهة أونيكس مع ترجمة عربية مدمجة",
  },
  {
    id: "vidlink",
    name: "VidLink Pro",
    nameAr: "فيد لينك برو",
    supportsSubtitles: true,
    priority: 2,
    description: "Custom color + subtitle file",
    descriptionAr: "لون مخصص وملف ترجمة",
  },
  {
    id: "vidsrc",
    name: "VidSrc Ultra",
    nameAr: "فيد سورس الترا",
    supportsSubtitles: false,
    priority: 3,
    description: "Fast multi-source embed",
    descriptionAr: "مصادر متعددة سريعة",
  },
  {
    id: "2embed",
    name: "2Embed Primary",
    nameAr: "تو إمبيد",
    supportsSubtitles: false,
    priority: 4,
    description: "Reliable primary embed",
    descriptionAr: "مزود موثوق",
  },
  {
    id: "autoembed",
    name: "AutoEmbed Fast",
    nameAr: "أوتو إمبيد",
    supportsSubtitles: false,
    priority: 5,
    description: "TMDB-direct auto embed",
    descriptionAr: "إدراج مباشر من TMDB",
  },
  {
    id: "streambetter",
    name: "StreamBetter",
    nameAr: "ستريم بيتر",
    supportsSubtitles: false,
    priority: 6,
    description: "Multi-source aggregate",
    descriptionAr: "تجميع متعدد المصادر",
  },
  {
    id: "multiembed",
    name: "MultiEmbed",
    nameAr: "مالتي إمبيد",
    supportsSubtitles: false,
    priority: 7,
    description: "Fallback cinema embed",
    descriptionAr: "إدراج سينمائي احتياطي",
  },
];

/**
 * Build a provider iframe URL per the spec.
 * All providers are embedded from third-party services.
 */
export function buildStreamUrl(serverId: string, params: StreamParams): string {
  const {
    tmdbId,
    type,
    season = 1,
    episode = 1,
    subtitleVttUrl,
    subtitleLabel = "Arabic",
  } = params;
  const encodedSub = subtitleVttUrl ? encodeURIComponent(subtitleVttUrl) : "";

  switch (serverId) {
    case "embedmaster": {
      const subQuery = encodedSub
        ? `&sub_url[]=${encodedSub}&sub_label[]=${encodeURIComponent(subtitleLabel)}`
        : "";
      if (type === "movie") {
        return `https://embedmaster.link/movie/${tmdbId}?skin=onyx${subQuery}`;
      }
      return `https://embedmaster.link/tv/${tmdbId}/${season}/${episode}?skin=onyx${subQuery}`;
    }

    case "vidlink": {
      const subQuery = encodedSub
        ? `&sub_file=${encodedSub}&sub_label=${encodeURIComponent(subtitleLabel)}`
        : "";
      if (type === "movie") {
        return `https://vidlink.pro/movie/${tmdbId}?primaryColor=0b0c10&secondaryColor=06b6d4&iconColor=ffffff${subQuery}`;
      }
      return `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=0b0c10&secondaryColor=06b6d4&iconColor=ffffff${subQuery}`;
    }

    case "vidsrc": {
      if (type === "movie") {
        return `https://vidsrc.su/embed/movie/${tmdbId}`;
      }
      return `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${episode}`;
    }

    case "2embed": {
      if (type === "movie") {
        return `https://www.2embed.cc/embed/${tmdbId}`;
      }
      return `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
    }

    case "autoembed": {
      if (type === "movie") {
        return `https://autoembed.co/movie/tmdb/${tmdbId}`;
      }
      return `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`;
    }

    case "streambetter": {
      if (type === "movie") {
        return `https://streambetter.lol/filme/${tmdbId}`;
      }
      return `https://streambetter.lol/serie/${tmdbId}/${season}/${episode}`;
    }

    case "multiembed": {
      if (type === "movie") {
        return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
      }
      return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
    }

    default:
      return `https://embedmaster.link/movie/${tmdbId}?skin=onyx`;
  }
}

export const DEFAULT_SERVER_ID = "embedmaster";

export function getServerById(id: string): StreamServerOption {
  return STREAM_SERVERS.find((s) => s.id === id) ?? STREAM_SERVERS[0];
}
