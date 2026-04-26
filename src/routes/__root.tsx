import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SessionStateProvider } from "@/contexts/SessionStateContext";
import { lovable } from "@/integrations/lovable";
import { Leaf, LayoutDashboard, Settings, LogIn, LogOut, BookmarkIcon, History, StickyNote, UserCircle, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-semibold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ZenTube — Watch with intent" },
      { name: "description", content: "A calm, intent-driven way to discover YouTube videos. No infinite scroll. No autoplay. Just what you came for." },
      { name: "author", content: "ZenTube" },
      { property: "og:title", content: "ZenTube — Watch with intent" },
      { property: "og:description", content: "A calm, intent-driven way to discover YouTube videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionStateProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster />
        </SessionStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { location } = useRouterState();
  const onAuthPage = location.pathname.startsWith("/login");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const signInWithGoogle = async (switchAccount = false) => {
    setAccountOpen(false);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + location.href,
        extraParams: switchAccount ? { prompt: "select_account" } : undefined,
      });
      if (result.error) toast.error(result.error.message || "Google sign-in failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!onAuthPage && (
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="zen-container-wide flex h-14 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight">ZenTube</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              {user && (
                <>
                  <Link to="/dashboard" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
                    <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Insights</span>
                  </Link>
                  <Link to="/library" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
                    <BookmarkIcon className="h-4 w-4" /> <span className="hidden sm:inline">Library</span>
                  </Link>
                  <Link to="/notes" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
                    <StickyNote className="h-4 w-4" /> <span className="hidden sm:inline">Notes</span>
                  </Link>
                  <Link to="/history" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
                    <History className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
                  </Link>
                  <Link to="/settings" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground" activeProps={{ className: "text-foreground bg-accent" }}>
                    <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
                  </Link>
                </>
              )}
              <div ref={accountRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2 py-1.5 text-foreground hover:bg-accent"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover/95 p-1 shadow-2xl backdrop-blur">
                    {user ? (
                      <>
                        <div className="px-3 py-3">
                          <div className="truncate text-sm font-medium text-foreground">{user.user_metadata?.full_name || user.email}</div>
                          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                        </div>
                        <Link to="/settings" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent">
                          <Settings className="h-4 w-4" /> Settings
                        </Link>
                        <button onClick={() => signInWithGoogle(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent">
                          <LogIn className="h-4 w-4" /> Switch account
                        </button>
                        <button onClick={() => { setAccountOpen(false); void signOut(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent">
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="px-3 py-3 text-sm text-muted-foreground">Sign in to save your history, notes, library, and insights.</div>
                        <button onClick={() => signInWithGoogle(false)} className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground hover:opacity-90">
                          <LogIn className="h-4 w-4" /> Sign in with Google
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>
      )}
      <main className="zen-fade-in">{children}</main>
    </div>
  );
}
