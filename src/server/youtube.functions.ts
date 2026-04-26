import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseISODuration, type Mode, type ResultVideo } from "@/lib/intent";

const SearchInput = z.object({
  query: z.string().min(1).max(300),
  mode: z.enum(["learn", "relax", "find", "explore"]),
  freeform: z.string().max(300).optional(),
  chips: z.array(z.string()).max(20).optional(),
  maxResults: z.number().int().min(3).max(15).optional(),
  variation: z.number().int().min(0).max(20).optional(),
  sortBy: z.enum(["relevance", "latest"]).optional(),
  durationFilter: z.enum(["any", "short", "medium", "long"]).optional(),
  pageToken: z.string().max(200).optional(),
});

type Input = z.infer<typeof SearchInput>;

type SearchContext = {
  intent: "freshness" | "creator" | "content_type" | "general";
  creator: string | null;
  contentType: string | null;
  sortBy: "relevance" | "latest";
  durationFilter: "any" | "short" | "medium" | "long";
  summary: string;
};

const YT_BASE = "https://www.googleapis.com/youtube/v3";

const VARIATION_SUFFIX = ["", "best", "explained", "complete", "recommended", "in depth", "top"];
const FRESHNESS_RE = /\b(new|latest|recent|today|upload|uploads|uploaded|newest)\b/i;
const CONTENT_TYPE_RE = /\b(song|music|trailer|interview|full movie|movie|lofi|remix|live)\b/i;
const EDUCATION_RE = /\b(learn|tutorial|how to|course|guide|explained?|build|project|code|coding|kafka|react|python|data engineering|sql|javascript|typescript|docker|kubernetes|aws)\b/i;
const GENERIC_VIDEO_RE = /\b(video|videos|channel|episode|vlog)\b/i;
const KNOWN_CREATORS: Array<[RegExp, string]> = [
  [/\bmr\s*beast\b|\bmrbeast\b/i, "MrBeast"],
  [/\bcarry\s*minati\b|\bcarryminati\b/i, "CarryMinati"],
  [/\bcode\s*with\s*yu\b|\bcodewithyu\b/i, "CodeWithYu"],
];

function normalize(s: string) {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCaseCreator(s: string) {
  const known = KNOWN_CREATORS.find(([re]) => re.test(s));
  if (known) return known[1];
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function detectContentType(q: string): string | null {
  const m = q.match(CONTENT_TYPE_RE)?.[1]?.toLowerCase();
  if (!m) return null;
  if (m.includes("song") || m.includes("music")) return "song";
  if (m.includes("trailer")) return "trailer";
  if (m.includes("interview")) return "interview";
  if (m.includes("movie")) return "movie";
  if (m.includes("lofi")) return "lofi";
  if (m.includes("remix")) return "remix";
  if (m.includes("live")) return "live";
  return m;
}

function stripIntentWords(q: string) {
  return normalize(q)
    .replace(/\b(new|latest|recent|today|upload|uploads|uploaded|newest|video|videos|official|watch)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCreator(rawQuery: string, mode: Mode, freshness: boolean, contentType: string | null): { creator: string | null; contentTerms: string } {
  for (const [re, name] of KNOWN_CREATORS) {
    if (re.test(rawQuery)) {
      const contentTerms = stripIntentWords(rawQuery.replace(re, " "));
      return { creator: name, contentTerms };
    }
  }

  if (contentType || EDUCATION_RE.test(rawQuery)) return { creator: null, contentTerms: "" };

  const cleaned = stripIntentWords(rawQuery);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const shouldTryCreator = freshness || GENERIC_VIDEO_RE.test(rawQuery) || (mode === "find" && tokens.length <= 3);
  if (!shouldTryCreator || tokens.length === 0) return { creator: null, contentTerms: "" };

  const creatorTokens = tokens.length >= 3 && freshness ? tokens.slice(0, 2) : tokens.slice(0, Math.min(tokens.length, 3));
  const contentTerms = tokens.slice(creatorTokens.length).join(" ");
  return { creator: titleCaseCreator(creatorTokens.join(" ")), contentTerms };
}

function durationFromChips(chips: string[], explicit?: "any" | "short" | "medium" | "long") {
  if (explicit && explicit !== "any") return explicit;
  const chipText = chips.join(" ").toLowerCase();
  if (/under 15|\bshort\b|5 min/.test(chipText)) return "short";
  if (/around 1 hour|\bmedium\b/.test(chipText)) return "medium";
  if (/full course|\blong\b/.test(chipText)) return "long";
  return explicit ?? "any";
}

function buildSearchQuery(input: Input): {
  q: string;
  videoDuration?: "short" | "medium" | "long" | "any";
  order: "relevance" | "viewCount" | "date";
  videoCategoryId?: string;
  context: SearchContext;
  creator: string | null;
  contentTerms: string;
  titleTerms: string[];
} {
  const { query, mode, freeform, chips = [], variation = 0 } = input;
  const freshness = FRESHNESS_RE.test(query) || input.sortBy === "latest";
  const contentType = detectContentType(query);
  const { creator, contentTerms } = detectCreator(query, mode, freshness, contentType);
  const parts: string[] = [];
  const durationFilter = durationFromChips(chips, input.durationFilter);
  let order: "relevance" | "viewCount" | "date" = freshness ? "date" : "relevance";
  let videoCategoryId: string | undefined;

  if (input.sortBy === "latest") order = "date";
  if (contentType === "song" || contentType === "lofi" || contentType === "remix" || contentType === "live") videoCategoryId = "10";
  if (contentType === "trailer" || contentType === "movie") videoCategoryId = "1";

  if (creator) {
    parts.push(creator);
    if (contentTerms) parts.push(contentTerms);
  } else {
    parts.push(query.trim());
  }

  const chipText = chips.join(" ").toLowerCase();
  if (mode === "learn") {
    if (/beginner/.test(chipText)) parts.push("for beginners");
    if (/advanced/.test(chipText)) parts.push("advanced");
    if (/step-by-step|crash course/.test(chipText)) parts.push("tutorial");
    if (/deep dive/.test(chipText)) parts.push("in depth");
    if (/overview/.test(chipText)) parts.push("explained");
    for (const c of chips) {
      if (!/beginner|intermediate|advanced|step-by-step|overview|deep dive|crash course|under 15|around 1 hour|full course|short|medium|long/i.test(c)) parts.push(c);
    }
  } else if (mode === "relax") {
    for (const c of chips) if (!/short|medium|long/i.test(c)) parts.push(c);
  } else if (mode === "explore") {
    if (/playlist/.test(chipText)) parts.push("series guide");
    else parts.push("best");
  } else if (mode === "find") {
    if (/official/.test(chipText) && !/official/i.test(parts.join(" "))) parts.push("official");
  }

  if (contentType === "song" && !/official|remix|live|lofi/i.test(parts.join(" "))) parts.push("official");
  if (freeform?.trim()) parts.push(freeform.trim());

  if (!input.pageToken && variation > 0 && !freshness) {
    const suffix = VARIATION_SUFFIX[variation % VARIATION_SUFFIX.length];
    if (suffix) parts.push(suffix);
  }

  const q = parts.join(" ").replace(/\s+/g, " ").trim();
  const titleTerms = normalize([query, contentTerms].filter(Boolean).join(" "))
    .split(" ")
    .filter((t) => t.length > 2 && !/new|latest|recent|today|upload|video|videos/.test(t));

  const summary = creator && freshness
    ? `Showing latest videos from ${creator}`
    : creator
      ? `Prioritizing videos from ${creator}`
      : freshness
        ? "Sorted by: Recently uploaded"
        : contentType
          ? `Prioritizing ${contentType} results`
          : "Showing the most relevant intentional picks";

  return {
    q,
    videoDuration: durationFilter,
    order,
    videoCategoryId,
    context: {
      intent: freshness ? "freshness" : creator ? "creator" : contentType ? "content_type" : "general",
      creator,
      contentType,
      sortBy: order === "date" ? "latest" : "relevance",
      durationFilter,
      summary,
    },
    creator,
    contentTerms,
    titleTerms,
  };
}

function daysSince(date: string) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return 3650;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function titleMatchScore(title: string, terms: string[]) {
  if (terms.length === 0) return 0;
  const t = normalize(title);
  const hits = terms.filter((term) => t.includes(term)).length;
  return (hits / terms.length) * 20;
}

function fitScore(durationBucket: "short" | "medium" | "long" | "any", durationSeconds: number): number {
  if (durationBucket === "short") return durationSeconds >= 75 && durationSeconds <= 5 * 60 ? 12 : -8;
  if (durationBucket === "medium") return durationSeconds >= 5 * 60 && durationSeconds <= 25 * 60 ? 12 : -4;
  if (durationBucket === "long") return durationSeconds >= 25 * 60 ? 12 : -8;
  return durationSeconds >= 120 ? 4 : -10;
}

function rankScore(v: ResultVideo, context: SearchContext, titleTerms: string[]): number {
  const channelNorm = normalize(v.channel);
  const creatorNorm = normalize(context.creator || "");
  const channelMatch = creatorNorm
    ? channelNorm === creatorNorm ? 100 : channelNorm.includes(creatorNorm) || creatorNorm.includes(channelNorm) ? 72 : -18
    : 0;
  const recency = Math.max(0, 35 - daysSince(v.publishedAt) / (context.sortBy === "latest" ? 3 : 18));
  const relevance = titleMatchScore(v.title, titleTerms);
  const quality = Math.log10(Math.max(v.viewCount, 1)) * 4 + fitScore(context.durationFilter, v.durationSeconds);
  return channelMatch + (context.sortBy === "latest" ? recency * 2.2 : recency * 0.7) + relevance + quality;
}

function reasonFor(context: SearchContext, v: ResultVideo): string {
  if (context.creator && normalize(v.channel).includes(normalize(context.creator))) {
    if (context.sortBy === "latest") return `Latest upload match from ${v.channel}`;
    return `Because it matches the creator you searched for: ${v.channel}`;
  }
  if (context.sortBy === "latest") return "Because it is one of the more recent relevant uploads";
  if (context.contentType === "song") return "Because it matches the requested music style and avoids Shorts";
  if (/course|tutorial|lesson|crash|guide/i.test(v.title)) return "Structured tutorial format from a relevant channel";
  if (v.viewCount > 500_000) return `Relevant result with strong viewer signal from ${v.channel}`;
  return `Relevant focused pick from ${v.channel}`;
}

export type ResultPlaylist = {
  playlistId: string;
  title: string;
  channel: string;
  channelId: string;
  description: string;
  thumbnail: string;
  itemCount: number;
  reason: string;
};

export type PlaylistItem = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
  position: number;
};

async function fetchPlaylists(apiKey: string, q: string): Promise<ResultPlaylist[]> {
  try {
    const params = new URLSearchParams({ part: "snippet", q, maxResults: "5", type: "playlist", safeSearch: "moderate", key: apiKey });
    const res = await fetch(`${YT_BASE}/search?${params.toString()}`);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items: Array<{ id: { playlistId: string }; snippet: { title: string; channelTitle: string; channelId: string; description: string; thumbnails: { medium?: { url: string }; high?: { url: string } } } }>;
    };
    const ids = json.items.map((i) => i.id.playlistId).filter(Boolean);
    if (ids.length === 0) return [];
    const dParams = new URLSearchParams({ part: "contentDetails", id: ids.join(","), key: apiKey });
    const dRes = await fetch(`${YT_BASE}/playlists?${dParams.toString()}`);
    const dJson = dRes.ok ? ((await dRes.json()) as { items: Array<{ id: string; contentDetails: { itemCount: number } }> }) : { items: [] };
    const countMap = new Map(dJson.items.map((d) => [d.id, d.contentDetails.itemCount]));

    return json.items
      .map((it) => ({
        playlistId: it.id.playlistId,
        title: it.snippet.title,
        channel: it.snippet.channelTitle,
        channelId: it.snippet.channelId,
        description: it.snippet.description,
        thumbnail: it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
        itemCount: countMap.get(it.id.playlistId) || 0,
        reason: `Only videos from this playlist · ${countMap.get(it.id.playlistId) || 0} videos`,
      }))
      .filter((p) => p.itemCount >= 3)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export const searchVideos = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { error: "YouTube API key is not configured.", results: [] as ResultVideo[], playlists: [] as ResultPlaylist[], effectiveQuery: "", searchContext: null as SearchContext | null, nextPageToken: null as string | null };
    }

    const built = buildSearchQuery(data);
    const limit = data.maxResults ?? (data.mode === "find" ? 5 : data.mode === "explore" ? 5 : 7);
    const searchParams = new URLSearchParams({ part: "snippet", q: built.q, maxResults: "25", type: "video", safeSearch: "moderate", order: built.order, key: apiKey });
    if (data.pageToken) searchParams.set("pageToken", data.pageToken);
    if (built.videoDuration && built.videoDuration !== "any") searchParams.set("videoDuration", built.videoDuration);
    if (built.videoCategoryId) searchParams.set("videoCategoryId", built.videoCategoryId);

    try {
      const includePlaylists = data.mode === "learn" || data.mode === "explore" || /playlist|course|series/i.test(data.query + " " + (data.freeform || ""));
      const [sRes, playlists] = await Promise.all([
        fetch(`${YT_BASE}/search?${searchParams.toString()}`),
        includePlaylists && !data.pageToken ? fetchPlaylists(apiKey, built.q) : Promise.resolve([]),
      ]);

      if (!sRes.ok) {
        const body = await sRes.text();
        console.error("YouTube search failed", sRes.status, body);
        return { error: `Search failed (${sRes.status})`, results: [] as ResultVideo[], playlists: [] as ResultPlaylist[], effectiveQuery: built.q, searchContext: built.context, nextPageToken: null as string | null };
      }
      const sJson = (await sRes.json()) as {
        nextPageToken?: string;
        items: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; channelId: string; description: string; publishedAt: string; thumbnails: { medium?: { url: string }; high?: { url: string } } } }>;
      };

      const ids = sJson.items.map((i) => i.id.videoId).filter(Boolean);
      if (ids.length === 0) return { error: null, results: [] as ResultVideo[], playlists, effectiveQuery: built.q, searchContext: built.context, nextPageToken: sJson.nextPageToken ?? null };

      const dParams = new URLSearchParams({ part: "contentDetails,statistics", id: ids.join(","), key: apiKey });
      const dRes = await fetch(`${YT_BASE}/videos?${dParams.toString()}`);
      if (!dRes.ok) {
        const body = await dRes.text();
        console.error("YouTube videos failed", dRes.status, body);
        return { error: `Details failed (${dRes.status})`, results: [] as ResultVideo[], playlists, effectiveQuery: built.q, searchContext: built.context, nextPageToken: sJson.nextPageToken ?? null };
      }
      const dJson = (await dRes.json()) as { items: Array<{ id: string; contentDetails: { duration: string }; statistics: { viewCount?: string } }> };
      const detailMap = new Map(dJson.items.map((it) => [it.id, it]));

      const results: ResultVideo[] = sJson.items
        .map((it) => {
          const d = detailMap.get(it.id.videoId);
          const durationSeconds = d ? parseISODuration(d.contentDetails.duration) : 0;
          const viewCount = d ? parseInt(d.statistics.viewCount || "0", 10) : 0;
          const v: ResultVideo = {
            videoId: it.id.videoId,
            title: it.snippet.title,
            channel: it.snippet.channelTitle,
            channelId: it.snippet.channelId,
            description: it.snippet.description,
            thumbnail: it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
            publishedAt: it.snippet.publishedAt,
            durationSeconds,
            viewCount,
            reason: "",
          };
          v.reason = reasonFor(built.context, v);
          return v;
        })
        .filter((v) => {
          if (v.durationSeconds <= 65) return false;
          if (/#shorts?\b|\bshorts\b/i.test(v.title + " " + v.description)) return false;
          if (data.mode === "learn" && v.durationSeconds < 90) return false;
          return v.durationSeconds > 0;
        });

      results.sort((a, b) => rankScore(b, built.context, built.titleTerms) - rankScore(a, built.context, built.titleTerms));
      const trimmed = results.slice(0, limit);
      if (trimmed[0]) trimmed[0].primary = true;

      return { error: null, results: trimmed, playlists, effectiveQuery: built.q, searchContext: built.context, nextPageToken: sJson.nextPageToken ?? null };
    } catch (err) {
      console.error("YouTube search error", err);
      return { error: "Could not reach YouTube right now.", results: [] as ResultVideo[], playlists: [] as ResultPlaylist[], effectiveQuery: built.q, searchContext: built.context, nextPageToken: null as string | null };
    }
  });

const PlaylistItemsInput = z.object({ playlistId: z.string().min(5).max(64) });

export const getPlaylistItems = createServerFn({ method: "POST" })
  .inputValidator((input: { playlistId: string }) => PlaylistItemsInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { items: [] as PlaylistItem[], error: "API key missing" };
    try {
      const params = new URLSearchParams({ part: "snippet,contentDetails", playlistId: data.playlistId, maxResults: "50", key: apiKey });
      const res = await fetch(`${YT_BASE}/playlistItems?${params.toString()}`);
      if (!res.ok) return { items: [] as PlaylistItem[], error: `playlistItems ${res.status}` };
      const json = (await res.json()) as {
        items: Array<{ snippet: { title: string; videoOwnerChannelTitle?: string; position: number; thumbnails: { medium?: { url: string }; high?: { url: string } }; resourceId: { videoId: string } } }>;
      };
      const ids = json.items.map((i) => i.snippet.resourceId.videoId).filter(Boolean);
      const dParams = new URLSearchParams({ part: "contentDetails", id: ids.join(","), key: apiKey });
      const dRes = await fetch(`${YT_BASE}/videos?${dParams.toString()}`);
      const dJson = dRes.ok ? ((await dRes.json()) as { items: Array<{ id: string; contentDetails: { duration: string } }> }) : { items: [] };
      const durMap = new Map(dJson.items.map((d) => [d.id, parseISODuration(d.contentDetails.duration)]));

      const items: PlaylistItem[] = json.items
        .map((it) => ({
          videoId: it.snippet.resourceId.videoId,
          title: it.snippet.title,
          channel: it.snippet.videoOwnerChannelTitle || "",
          thumbnail: it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
          durationSeconds: durMap.get(it.snippet.resourceId.videoId) || 0,
          position: it.snippet.position,
        }))
        .filter((v) => v.title !== "Deleted video" && v.title !== "Private video" && v.durationSeconds > 65 && !/#shorts?\b|\bshorts\b/i.test(v.title));
      return { items, error: null as string | null };
    } catch (err) {
      console.error("getPlaylistItems error", err);
      return { items: [] as PlaylistItem[], error: "Failed to fetch" };
    }
  });

const MetaInput = z.object({ videoId: z.string().min(5).max(20) });

export type VideoMeta = {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  channelThumbnail: string;
  subscriberCount: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  description: string;
  durationSeconds: number;
  categoryId: string;
};

export const getVideoMeta = createServerFn({ method: "POST" })
  .inputValidator((input: { videoId: string }) => MetaInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { meta: null as VideoMeta | null, error: "API key missing" };

    try {
      const vParams = new URLSearchParams({ part: "snippet,contentDetails,statistics", id: data.videoId, key: apiKey });
      const vRes = await fetch(`${YT_BASE}/videos?${vParams.toString()}`);
      if (!vRes.ok) return { meta: null, error: `videos ${vRes.status}` };
      const vJson = (await vRes.json()) as {
        items: Array<{ id: string; snippet: { title: string; channelTitle: string; channelId: string; description: string; publishedAt: string; categoryId?: string }; contentDetails: { duration: string }; statistics: { viewCount?: string; likeCount?: string } }>;
      };
      const v = vJson.items[0];
      if (!v) return { meta: null, error: "Not found" };

      const cParams = new URLSearchParams({ part: "snippet,statistics", id: v.snippet.channelId, key: apiKey });
      const cRes = await fetch(`${YT_BASE}/channels?${cParams.toString()}`);
      const cJson = cRes.ok ? ((await cRes.json()) as { items: Array<{ snippet: { thumbnails: { default?: { url: string }; medium?: { url: string } } }; statistics: { subscriberCount?: string } }> }) : { items: [] };
      const ch = cJson.items[0];

      const meta: VideoMeta = {
        videoId: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        channelThumbnail: ch?.snippet.thumbnails.medium?.url || ch?.snippet.thumbnails.default?.url || "",
        subscriberCount: parseInt(ch?.statistics.subscriberCount || "0", 10),
        viewCount: parseInt(v.statistics.viewCount || "0", 10),
        likeCount: parseInt(v.statistics.likeCount || "0", 10),
        publishedAt: v.snippet.publishedAt,
        description: v.snippet.description,
        durationSeconds: parseISODuration(v.contentDetails.duration),
        categoryId: v.snippet.categoryId || "",
      };
      return { meta, error: null as string | null };
    } catch (err) {
      console.error("getVideoMeta error", err);
      return { meta: null as VideoMeta | null, error: "Failed to fetch" };
    }
  });
