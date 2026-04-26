import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MODES, type Mode, formatDuration } from "@/lib/intent";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — ZenTube" }] }),
  component: HistoryPage,
});

type H = {
  id: string;
  youtube_video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string | null;
  final_intent: string;
  watched_at: string;
  watched_duration: number;
};

function HistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<H[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("video_history")
      .select("id, youtube_video_id, title, channel_title, thumbnail_url, final_intent, watched_at, watched_duration")
      .eq("user_id", user.id)
      .order("watched_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setItems((data || []) as H[]));
  }, [user]);

  return (
    <div className="zen-container py-10">
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your last 100 watched videos. Time shown is what you actually watched.
      </p>

      <div className="mt-8 space-y-3">
        {items === null ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : items.length === 0 ? (
          <div className="zen-card p-6 text-sm text-muted-foreground">No history yet.</div>
        ) : (
          items.map((it) => {
            const intent = it.final_intent === "Learning" ? "learn" : it.final_intent === "Entertainment" ? "relax" : "find" as Mode;
            const m = MODES[intent];
            return (
              <Link
                key={it.id}
                to="/watch/$videoId"
                params={{ videoId: it.youtube_video_id }}
                search={{
                  title: it.title || "",
                  channel: it.channel_title || "",
                  duration: 0,
                  thumbnail: it.thumbnail_url || "",
                  t: 0,
                  intent: intent,
                }}
                className="zen-card zen-card-hover flex items-center gap-4 p-3 sm:p-4"
              >
                <div className="aspect-video w-32 shrink-0 overflow-hidden rounded bg-muted sm:w-44">
                  {it.thumbnail_url && (
                    <img
                      src={it.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium text-foreground sm:text-base">
                    {it.title || "Untitled"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{it.channel_title}</span>
                    <span>·</span>
                    <span>{m ? `${m.emoji} ${m.label}` : intent}</span>
                    <span>·</span>
                    <span>{formatDuration(it.watched_duration)} watched</span>
                    <span>·</span>
                    <span>{new Date(it.watched_at).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
