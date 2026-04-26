import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { memo, useEffect, useState } from "react";
import { searchVideos, getPlaylistItems, type ResultPlaylist, type PlaylistItem } from "@/server/youtube.functions";
import { useSessionState } from "@/contexts/SessionStateContext";
import { formatDuration, MODES, detectMismatch, type Mode, type ResultVideo } from "@/lib/intent";
import { Player } from "@/components/Player";
import { ArrowLeft, RefreshCw, Sliders, Search as SearchIcon, AlertCircle, ListVideo, Play, Check, Clock } from "lucide-react";

export const Route = createFileRoute("/results")({
  head: () => ({ meta: [{ title: "Results — ZenTube" }] }),
  component: ResultsPage,
});

type SortBy = "relevance" | "latest";
type DurationFilter = "any" | "short" | "medium" | "long";

function ResultsPage() {
  const { mode, refinement, query, setMode } = useSessionState();
  const navigate = useNavigate();
  const [variation, setVariation] = useState(0);
  const [refineText, setRefineText] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("relevance");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("any");
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [activePlaylist, setActivePlaylist] = useState<ResultPlaylist | null>(null);

  useEffect(() => {
    if (!mode || !query) navigate({ to: "/" });
  }, [mode, query, navigate]);

  useEffect(() => {
    setPageToken(undefined);
    setVariation(0);
  }, [sortBy, durationFilter, query, mode, refinement?.chips, refinement?.freeform]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["search", mode, query, refinement?.chips, refinement?.freeform, refineText, variation, sortBy, durationFilter, pageToken],
    enabled: !!mode && !!query,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      searchVideos({
        data: {
          query,
          mode: mode!,
          chips: refinement?.chips ?? [],
          freeform: [refinement?.freeform ?? "", refineText].filter(Boolean).join(" "),
          variation,
          sortBy,
          durationFilter,
          pageToken,
        },
      }),
  });

  if (!mode || !query) return null;
  if (activePlaylist) return <PlaylistFocusView playlist={activePlaylist} onBack={() => setActivePlaylist(null)} />;

  const cfg = MODES[mode];
  const mismatch = detectMismatch(mode, query);

  const loadNext = () => {
    if (data?.nextPageToken) setPageToken(data.nextPageToken);
    else setVariation((v) => v + 1);
  };

  return (
    <div className="zen-container py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> New search
          </Link>
          <button
            onClick={loadNext}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            title="Fetch the next batch with the same filters"
          >
            <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
            Load more
          </button>
        </div>

        <div className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            <span aria-hidden>{cfg.emoji}</span>
            {cfg.label}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">"{query}"</h1>
          {refinement?.chips && refinement.chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {refinement.chips.map((c) => (
                <span key={c} className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground">{c}</span>
              ))}
            </div>
          )}

          {data?.searchContext && (
            <div className="mt-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <SearchIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1">
                  {data.searchContext.summary} · Search: <span className="text-foreground">{data.effectiveQuery}</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                <span className="rounded-full bg-background px-2 py-0.5">Sort: {data.searchContext.sortBy === "latest" ? "Latest" : "Relevance"}</span>
                <span className="rounded-full bg-background px-2 py-0.5">Duration: {durationLabel(data.searchContext.durationFilter)}</span>
                {data.searchContext.creator && <span className="rounded-full bg-background px-2 py-0.5">Creator: {data.searchContext.creator}</span>}
              </div>
            </div>
          )}

          {mismatch.mismatched && mismatch.suggested && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1">
                <span className="text-foreground">{mismatch.reason}</span>
                <button onClick={() => setMode(mismatch.suggested!)} className="ml-2 text-primary underline hover:opacity-80">
                  Switch to {MODES[mismatch.suggested].label}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 focus-within:border-primary/50">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              <input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") refetch(); }}
                placeholder="Refine — e.g. 'latest challenge', 'official', 'in Hindi'"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {refineText && (
                <button onClick={() => refetch()} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
                  Apply
                </button>
              )}
            </div>
            <Segmented value={sortBy} onChange={(v) => setSortBy(v as SortBy)} options={[{ value: "relevance", label: "Relevance" }, { value: "latest", label: "Latest" }]} />
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value as DurationFilter)}
              className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none hover:bg-accent"
              aria-label="Duration filter"
            >
              <option value="any">Any duration</option>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>
        </div>

        {isLoading || isFetching ? (
          <ResultsSkeleton />
        ) : error ? (
          <div className="zen-card mt-12 p-6 text-sm text-muted-foreground">
            Something went wrong fetching results. <button onClick={() => refetch()} className="text-primary hover:underline">Try again</button>
          </div>
        ) : data?.error ? (
          <div className="zen-card mt-12 p-6 text-sm text-muted-foreground">{data.error}</div>
        ) : !data?.results.length && !data?.playlists?.length ? (
          <div className="zen-card mt-12 p-6 text-sm text-muted-foreground">No good matches. Try different phrasing or load another batch.</div>
        ) : (
          <ResultsList results={data.results} playlists={data.playlists || []} mode={mode} onOpenPlaylist={setActivePlaylist} />
        )}
      </div>
    </div>
  );
}

function durationLabel(d: DurationFilter) {
  if (d === "short") return "Short";
  if (d === "medium") return "Medium";
  if (d === "long") return "Long";
  return "Any";
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={("rounded-full px-3 py-1 transition-colors " + (value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="zen-card flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
          <div className="zen-skeleton aspect-video w-full sm:w-64" />
          <div className="flex-1 space-y-3">
            <div className="zen-skeleton h-4 w-3/4" />
            <div className="zen-skeleton h-3 w-1/3" />
            <div className="zen-skeleton h-3 w-full" />
            <div className="zen-skeleton h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsList({ results, playlists, mode, onOpenPlaylist }: { results: ResultVideo[]; playlists: ResultPlaylist[]; mode: Mode; onOpenPlaylist: (p: ResultPlaylist) => void }) {
  const primary = results.find((r) => r.primary) ?? results[0];
  const rest = results.filter((r) => primary && r.videoId !== primary.videoId);
  return (
    <div className="mt-6 space-y-4">
      {primary && <ResultCard v={primary} highlighted={mode === "find" || primary.primary} />}
      {playlists.length > 0 && (
        <>
          <div className="pt-2 text-xs uppercase tracking-wider text-muted-foreground">Focused playlists</div>
          {playlists.map((p) => <PlaylistCard key={p.playlistId} p={p} onOpen={() => onOpenPlaylist(p)} />)}
        </>
      )}
      {rest.length > 0 && (
        <>
          <div className="pt-2 text-xs uppercase tracking-wider text-muted-foreground">Alternatives</div>
          {rest.map((r) => <ResultCard key={r.videoId} v={r} />)}
        </>
      )}
      <p className="pt-6 text-center text-xs text-muted-foreground">Showing {results.length} curated picks. Load more fetches a fresh batch without infinite scroll.</p>
    </div>
  );
}

const ResultCard = memo(function ResultCard({ v, highlighted }: { v: ResultVideo; highlighted?: boolean }) {
  return (
    <Link
      to="/watch/$videoId"
      params={{ videoId: v.videoId }}
      search={{ title: v.title, channel: v.channel, duration: v.durationSeconds, thumbnail: v.thumbnail, t: 0, intent: "" }}
      className={"zen-card zen-card-hover block overflow-hidden " + (highlighted ? "border-primary/40 ring-1 ring-primary/15" : "")}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="relative shrink-0 overflow-hidden rounded-md bg-muted sm:w-64">
          <div className="aspect-video w-full">{v.thumbnail ? <img src={v.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}</div>
          <div className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 py-0.5 text-xs text-foreground">{formatDuration(v.durationSeconds)}</div>
        </div>
        <div className="flex-1">
          {highlighted && <div className="mb-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">Primary pick</div>}
          <h3 className="text-base font-medium leading-snug text-foreground sm:text-lg">{v.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{v.channel}</span>
            {v.publishedAt && <><span aria-hidden>·</span><span className="text-xs">{new Date(v.publishedAt).toLocaleDateString()}</span></>}
          </div>
          <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">{v.reason}</p>
        </div>
      </div>
    </Link>
  );
});

function PlaylistCard({ p, onOpen }: { p: ResultPlaylist; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="zen-card zen-card-hover flex w-full flex-col gap-4 p-4 text-left sm:flex-row sm:p-5">
      <div className="relative shrink-0 overflow-hidden rounded-md bg-muted sm:w-64">
        <div className="aspect-video w-full">{p.thumbnail && <img src={p.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/55"><ListVideo className="h-8 w-8 text-primary" /></div>
        <div className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 py-0.5 text-xs text-foreground">{p.itemCount} videos</div>
      </div>
      <div className="flex-1">
        <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary"><ListVideo className="h-3 w-3" /> Playlist</div>
        <h3 className="text-base font-medium leading-snug text-foreground sm:text-lg">{p.title}</h3>
        <div className="mt-1 text-sm text-muted-foreground">{p.channel}</div>
        <p className="mt-2 text-sm text-muted-foreground">{p.reason}</p>
        <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary"><Play className="h-3.5 w-3.5" /> Open focused playlist view</div>
      </div>
    </button>
  );
}

function PlaylistFocusView({ playlist, onBack }: { playlist: ResultPlaylist; onBack: () => void }) {
  const { data, isFetching } = useQuery({
    queryKey: ["playlist-items", playlist.playlistId],
    queryFn: () => getPlaylistItems({ data: { playlistId: playlist.playlistId } }),
    staleTime: 10 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.videoId === selectedId) ?? items[0];
  useEffect(() => { if (!selectedId && items[0]) setSelectedId(items[0].videoId); }, [items, selectedId]);

  return (
    <div className="zen-container-wide py-8 sm:py-10">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </button>
      <div className="mt-5">
        <div className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"><ListVideo className="h-3.5 w-3.5" /> Focused playlist</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{playlist.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only videos from this playlist are shown — no unrelated recommendations.</p>
      </div>

      {isFetching ? (
        <ResultsSkeleton />
      ) : !selected ? (
        <div className="zen-card mt-8 p-6 text-sm text-muted-foreground">No playable videos found in this playlist.</div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <Player key={selected.videoId} videoId={selected.videoId} />
            <div className="mt-4">
              <div className="text-xs text-muted-foreground">Now playing · {selected.position + 1} of {items.length}</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{selected.title}</h2>
              <div className="mt-1 text-sm text-muted-foreground">{selected.channel} · {formatDuration(selected.durationSeconds)}</div>
            </div>
          </section>
          <aside className="zen-card h-fit overflow-hidden lg:sticky lg:top-20">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Playlist videos</div>
            <ol className="max-h-[68vh] divide-y divide-border overflow-y-auto">
              {items.map((it) => (
                <li key={it.videoId}>
                  <button
                    onClick={() => setSelectedId(it.videoId)}
                    className={"flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/30 " + (selected.videoId === it.videoId ? "bg-accent/40" : "")}
                  >
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{selected.videoId === it.videoId ? <Check className="mx-auto h-3.5 w-3.5 text-primary" /> : it.position + 1}</span>
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
                      {it.thumbnail && <img src={it.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-foreground">{it.title}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {formatDuration(it.durationSeconds)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
