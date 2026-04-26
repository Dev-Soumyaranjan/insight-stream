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
  sort: z.enum(["smart", "relevance", "latest"]).optional(),
  duration: z.enum(["any", "short", "medium", "long"]).optional(),
  pageToken: z.string().max(200).optional(),
});

type Input = z.infer<typeof SearchInput>;

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// Variation tweaks let the "Refresh" button surface different relevant videos
const VARIATION_SUFFIX = [
  "",
  "best",
  "explained",
  "complete",
  "popular",
  "recommended",
  "in depth",
  "top",
];

type SearchIntent = {
  freshness: boolean;
  creator: string | null;
  contentType: string | null;
  mood: string | null;
  transformedQuery: string;
  message: string;
};

const FRESHNESS_RE = /\b(new|latest|recent|today|upload|uploaded|newest)\b/i;
const CONTENT_TYPE_RE = /\b(song|trailer|interview|full movie|movie|challenge|podcast|review|tutorial|course)\b/i;
const MOOD_RE = /\b(sad|romantic|lofi|chill|emotional|energetic|funny|comedy)\b/i;

function analyzeQuery(rawQuery: string): SearchIntent {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  const freshness = FRESHNESS_RE.test(query);
  const contentType = query.match(CONTENT_TYPE_RE)?.[0]?.toLowerCase() ?? null;
  const mood = query.match(MOOD_RE)?.[0]?.toLowerCase() ?? null;
  const creatorCandidate = query
    .replace(FRESHNESS_RE, " ")
    .replace(/\b(video|videos|channel|from|by|official)\b/gi, " ")
    .replace(CONTENT_TYPE_RE, contentType === "challenge" ? "challenge" : " ")
    .replace(/\s+/g, " ")
    .trim();
  const creator = creatorCandidate && creatorCandidate.length <= 36 && /[a-z0-9]/i.test(creatorCandidate)
    ? creatorCandidate
    : null;
  const transformedQuery = freshness && creator ? creator : query;
  const bits: string[] = [];
  if (freshness) bits.push("latest uploads");
  if (creator) bits.push(`from ${creator}`);
  if (contentType && contentType !== "challenge") bits.push(contentType);
  if (mood) bits.push(`${mood} mood`);
  return {
    freshness,
    creator,
    contentType,
    mood,
    transformedQuery,
    message: bits.length ? `Showing ${bits.join(" · ")}` : "Showing the most relevant distraction-free matches",
  };
}

function buildSearchQuery(input: Input): {
  q: string;
  videoDuration?: "short" | "medium" | "long" | "any";
  order: "relevance" | "viewCount" | "date";
  intent: SearchIntent;
} {
  const { query, mode, freeform, chips = [], variation = 0 } = input;
  const intent = analyzeQuery(query);
  const parts: string[] = [intent.transformedQuery];
  let videoDuration: "short" | "medium" | "long" | "any" = input.duration ?? "any";
  let order: "relevance" | "viewCount" | "date" = "relevance";

  const chipText = chips.join(" ").toLowerCase();

  if (videoDuration === "any" && /under 15|\bshort\b|5 min/.test(chipText)) videoDuration = "short";
  else if (videoDuration === "any" && /around 1 hour|\bmedium\b/.test(chipText)) videoDuration = "medium";
  else if (videoDuration === "any" && /full course|\blong\b/.test(chipText)) videoDuration = "long";

  if (intent.freshness || input.sort === "latest") order = "date";
  if (input.sort === "relevance") order = "relevance";

  if (mode === "learn") {
    if (/beginner/.test(chipText)) parts.push("for beginners");
    if (/advanced/.test(chipText)) parts.push("advanced");
    if (/step-by-step|crash course/.test(chipText)) parts.push("tutorial");
    if (/deep dive/.test(chipText)) parts.push("in depth");
    if (/overview/.test(chipText)) parts.push("explained");
    for (const c of chips) {
      if (!/beginner|intermediate|advanced|step-by-step|overview|deep dive|crash course|under 15|around 1 hour|full course|short|medium|long/i.test(c)) {
        parts.push(c);
      }
    }
  } else if (mode === "relax") {
    for (const c of chips) {
      if (!/short|medium|long/i.test(c)) parts.push(c);
    }
  } else if (mode === "explore") {
    if (/playlist/.test(chipText)) parts.push("series guide");
    else parts.push("best");
    for (const c of chips) {
      if (!/intro|intermediate|expert|3 best picks|structured playlist|different angles/i.test(c)) {
        parts.push(c);
      }
    }
  } else if (mode === "find") {
    if (/official/.test(chipText)) parts.push("official");
    if (/latest/.test(chipText)) {
      parts.push("latest");
      order = "date";
    }
  }

  if (freeform && freeform.trim()) parts.push(freeform.trim());

  if (intent.contentType && !parts.join(" ").toLowerCase().includes(intent.contentType)) parts.push(intent.contentType);
  if (intent.mood && !parts.join(" ").toLowerCase().includes(intent.mood)) parts.push(intent.mood);

  // Variation: rotate through helper suffixes without breaking explicit freshness intent
  const v = variation % VARIATION_SUFFIX.length;
  if (v > 0) {
    parts.push(VARIATION_SUFFIX[v]);
    if (!intent.freshness && input.sort !== "latest") {
      if (v % 3 === 0) order = "viewCount";
      else if (v % 3 === 2) order = "date";
    }
  }

  return { q: parts.join(" "), videoDuration, order, intent };
}

function reasonFor(
  mode: Mode,
  v: { channel: string; durationSeconds: number; viewCount: number; title: string },
): string {
  const popular = v.viewCount > 500_000;
  if (mode === "learn") {
    if (/course|tutorial|lesson|crash|guide/i.test(v.title))
      return "Structured tutorial format from a credible channel";
    if (popular) return `Highly watched explanation by ${v.channel}`;
    return `Focused explainer from ${v.channel}`;
  }
  if (mode === "find") {
    if (/official/i.test(v.title)) return "Looks like the official version";
    if (popular) return "Most likely the version you're looking for";
    return "Best match for your query";
  }
  if (mode === "relax") {
    if (/relax|chill|ambient|lo[- ]?fi/i.test(v.title)) return "Calm, low-stimulation pick";
    return `Easy listening from ${v.channel}`;
  }
  if (popular) return "High-quality, widely watched pick";
  return `Curated from ${v.channel}`;
}

function fitScore(
  durationBucket: "short" | "medium" | "long" | "any",
  durationSeconds: number,
  views: number,
): number {
  const viewScore = Math.log10(Math.max(views, 1)) * 2;
  let durationFit = 1;
  if (durationBucket === "short") durationFit = durationSeconds <= 15 * 60 ? 1.5 : 0.6;
  else if (durationBucket === "medium")
    durationFit = durationSeconds >= 5 * 60 && durationSeconds <= 70 * 60 ? 1.5 : 0.7;
  else if (durationBucket === "long") durationFit = durationSeconds >= 30 * 60 ? 1.5 : 0.6;
  return viewScore * durationFit;
}

function rankScore(v: ResultVideo, intent: SearchIntent, rawQuery: string, bucket: "short" | "medium" | "long" | "any") {
  const hayTitle = v.title.toLowerCase();
  const hayChannel = v.channel.toLowerCase().replace(/[^a-z0-9]/g, "");
  const creator = intent.creator?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const ageDays = Math.max(0, (Date.now() - new Date(v.publishedAt).getTime()) / 86_400_000);
  const queryTerms = rawQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !FRESHNESS_RE.test(t));
  const titleMatches = queryTerms.filter((t) => hayTitle.includes(t)).length;
  let score = fitScore(bucket, v.durationSeconds, v.viewCount);
  if (creator && hayChannel.includes(creator)) score += 120;
  if (intent.freshness) score += Math.max(0, 90 - ageDays / 2);
  score += titleMatches * 10;
  if (intent.contentType && hayTitle.includes(intent.contentType)) score += 14;
  if (intent.mood && hayTitle.includes(intent.mood)) score += 12;
  return score;
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

async function fetchPlaylists(apiKey: string, q: string): Promise<ResultPlaylist[]> {
  try {
    const params = new URLSearchParams({
      part: "snippet",
      q,
      maxResults: "5",
      type: "playlist",
      safeSearch: "moderate",
      key: apiKey,
    });
    const res = await fetch(`${YT_BASE}/search?${params.toString()}`);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items: Array<{
        id: { playlistId: string };
        snippet: {
          title: string;
          channelTitle: string;
          channelId: string;
          description: string;
          thumbnails: { medium?: { url: string }; high?: { url: string } };
        };
      }>;
    };
    const ids = json.items.map((i) => i.id.playlistId).filter(Boolean);
    if (ids.length === 0) return [];

    // Fetch item counts
    const dParams = new URLSearchParams({
      part: "contentDetails",
      id: ids.join(","),
      key: apiKey,
    });
    const dRes = await fetch(`${YT_BASE}/playlists?${dParams.toString()}`);
    const dJson = dRes.ok
      ? ((await dRes.json()) as {
          items: Array<{ id: string; contentDetails: { itemCount: number } }>;
        })
      : { items: [] };
    const countMap = new Map(dJson.items.map((d) => [d.id, d.contentDetails.itemCount]));

    return json.items
      .map((it) => ({
        playlistId: it.id.playlistId,
        title: it.snippet.title,
        channel: it.snippet.channelTitle,
        channelId: it.snippet.channelId,
        description: it.snippet.description,
        thumbnail:
          it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
        itemCount: countMap.get(it.id.playlistId) || 0,
        reason: `Curated series · ${countMap.get(it.id.playlistId) || 0} videos`,
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
      return {
        error: "YouTube API key is not configured.",
        results: [] as ResultVideo[],
        playlists: [] as ResultPlaylist[],
        effectiveQuery: "",
        contextMessage: "Search is unavailable until video search is configured.",
        nextPageToken: null as string | null,
      };
    }

    const { q, videoDuration, order, intent } = buildSearchQuery(data);
    const limit = data.maxResults ?? (data.mode === "find" ? 5 : data.mode === "explore" ? 5 : 7);

    const searchParams = new URLSearchParams({
      part: "snippet",
      q,
      maxResults: "20",
      type: "video",
      safeSearch: "moderate",
      order,
      key: apiKey,
    });
    if (videoDuration && videoDuration !== "any") searchParams.set("videoDuration", videoDuration);
    if (data.pageToken) searchParams.set("pageToken", data.pageToken);

    try {
      // Run video + playlist searches in parallel for speed
      const includePlaylists = data.mode === "learn" || data.mode === "explore";
      const [sRes, playlists] = await Promise.all([
        fetch(`${YT_BASE}/search?${searchParams.toString()}`),
        includePlaylists ? fetchPlaylists(apiKey, q) : Promise.resolve([]),
      ]);

      if (!sRes.ok) {
        const body = await sRes.text();
        console.error("YouTube search failed", sRes.status, body);
        return { error: `Search failed (${sRes.status})`, results: [] as ResultVideo[], playlists: [] as ResultPlaylist[], effectiveQuery: q, contextMessage: intent.message, nextPageToken: null as string | null };
      }
      const sJson = (await sRes.json()) as {
        nextPageToken?: string;
        items: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            channelTitle: string;
            channelId: string;
            description: string;
            publishedAt: string;
            thumbnails: { medium?: { url: string }; high?: { url: string } };
          };
        }>;
      };

      const ids = sJson.items.map((i) => i.id.videoId).filter(Boolean);
      if (ids.length === 0) return { error: null, results: [] as ResultVideo[], playlists, effectiveQuery: q, contextMessage: intent.message, nextPageToken: sJson.nextPageToken ?? null };

      const dParams = new URLSearchParams({
        part: "contentDetails,statistics",
        id: ids.join(","),
        key: apiKey,
      });
      const dRes = await fetch(`${YT_BASE}/videos?${dParams.toString()}`);
      if (!dRes.ok) {
        const body = await dRes.text();
        console.error("YouTube videos failed", dRes.status, body);
        return { error: `Details failed (${dRes.status})`, results: [] as ResultVideo[], playlists, effectiveQuery: q, contextMessage: intent.message, nextPageToken: sJson.nextPageToken ?? null };
      }
      const dJson = (await dRes.json()) as {
        items: Array<{
          id: string;
          contentDetails: { duration: string };
          statistics: { viewCount?: string };
        }>;
      };
      const detailMap = new Map(dJson.items.map((it) => [it.id, it]));

      const results: ResultVideo[] = sJson.items
        .map((it) => {
          const d = detailMap.get(it.id.videoId);
          const durationSeconds = d ? parseISODuration(d.contentDetails.duration) : 0;
          const viewCount = d ? parseInt(d.statistics.viewCount || "0", 10) : 0;
          const v = {
            videoId: it.id.videoId,
            title: it.snippet.title,
            channel: it.snippet.channelTitle,
            channelId: it.snippet.channelId,
            description: it.snippet.description,
            thumbnail:
              it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
            publishedAt: it.snippet.publishedAt,
            durationSeconds,
            viewCount,
            reason: "",
          } as ResultVideo;
          v.reason = reasonFor(data.mode, v);
          return v;
        })
        .filter((v) => {
          if (v.durationSeconds <= 65) return false;
          if (/#shorts?\b/i.test(v.title)) return false;
          if (data.mode === "learn" && v.durationSeconds < 90) return false;
          return v.durationSeconds > 0;
        });

      const bucket = videoDuration ?? "any";
      results.sort(
        (a, b) =>
          rankScore(b, intent, data.query, bucket) -
          rankScore(a, intent, data.query, bucket),
      );

      const trimmed = results.slice(0, limit);
      if (trimmed[0]) trimmed[0].primary = true;

      return { error: null, results: trimmed, playlists, effectiveQuery: q, contextMessage: intent.message, nextPageToken: sJson.nextPageToken ?? null };
    } catch (err) {
      console.error("YouTube search error", err);
      return { error: "Could not reach YouTube right now.", results: [] as ResultVideo[], playlists: [] as ResultPlaylist[], effectiveQuery: q, contextMessage: intent.message, nextPageToken: null as string | null };
    }
  });

// --- Playlist items: load videos in a playlist on demand --------------------

const PlaylistItemsInput = z.object({ playlistId: z.string().min(5).max(64) });

export const getPlaylistItems = createServerFn({ method: "POST" })
  .inputValidator((input: { playlistId: string }) => PlaylistItemsInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { items: [] as Array<{ videoId: string; title: string; channel: string; thumbnail: string; durationSeconds: number; position: number }>, error: "API key missing" };
    try {
      const params = new URLSearchParams({
        part: "snippet,contentDetails",
        playlistId: data.playlistId,
        maxResults: "50",
        key: apiKey,
      });
      const res = await fetch(`${YT_BASE}/playlistItems?${params.toString()}`);
      if (!res.ok) return { items: [], error: `playlistItems ${res.status}` };
      const json = (await res.json()) as {
        items: Array<{
          snippet: {
            title: string;
            videoOwnerChannelTitle?: string;
            position: number;
            thumbnails: { medium?: { url: string }; high?: { url: string } };
            resourceId: { videoId: string };
          };
        }>;
      };
      const ids = json.items.map((i) => i.snippet.resourceId.videoId).filter(Boolean);
      const dParams = new URLSearchParams({
        part: "contentDetails",
        id: ids.join(","),
        key: apiKey,
      });
      const dRes = await fetch(`${YT_BASE}/videos?${dParams.toString()}`);
      const dJson = dRes.ok
        ? ((await dRes.json()) as { items: Array<{ id: string; contentDetails: { duration: string } }> })
        : { items: [] };
      const durMap = new Map(dJson.items.map((d) => [d.id, parseISODuration(d.contentDetails.duration)]));

      const items = json.items
        .map((it) => ({
          videoId: it.snippet.resourceId.videoId,
          title: it.snippet.title,
          channel: it.snippet.videoOwnerChannelTitle || "",
          thumbnail: it.snippet.thumbnails.high?.url || it.snippet.thumbnails.medium?.url || "",
          durationSeconds: durMap.get(it.snippet.resourceId.videoId) || 0,
          position: it.snippet.position,
        }))
        .filter((v) => v.title !== "Deleted video" && v.title !== "Private video");
      return { items, error: null as string | null };
    } catch (err) {
      console.error("getPlaylistItems error", err);
      return { items: [], error: "Failed to fetch" };
    }
  });

// --- Video metadata: stats + channel info -----------------------------------

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
      const vParams = new URLSearchParams({
        part: "snippet,contentDetails,statistics",
        id: data.videoId,
        key: apiKey,
      });
      const vRes = await fetch(`${YT_BASE}/videos?${vParams.toString()}`);
      if (!vRes.ok) return { meta: null, error: `videos ${vRes.status}` };
      const vJson = (await vRes.json()) as {
        items: Array<{
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            channelId: string;
            description: string;
            publishedAt: string;
            categoryId?: string;
          };
          contentDetails: { duration: string };
          statistics: { viewCount?: string; likeCount?: string };
        }>;
      };
      const v = vJson.items[0];
      if (!v) return { meta: null, error: "Not found" };

      // Channel: subscribers + thumbnail
      const cParams = new URLSearchParams({
        part: "snippet,statistics",
        id: v.snippet.channelId,
        key: apiKey,
      });
      const cRes = await fetch(`${YT_BASE}/channels?${cParams.toString()}`);
      const cJson = cRes.ok
        ? ((await cRes.json()) as {
            items: Array<{
              snippet: { thumbnails: { default?: { url: string }; medium?: { url: string } } };
              statistics: { subscriberCount?: string };
            }>;
          })
        : { items: [] };
      const ch = cJson.items[0];

      const meta: VideoMeta = {
        videoId: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        channelThumbnail:
          ch?.snippet.thumbnails.medium?.url || ch?.snippet.thumbnails.default?.url || "",
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
