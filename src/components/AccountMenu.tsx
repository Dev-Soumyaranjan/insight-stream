import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import {
  User as UserIcon,
  LogOut,
  UserPlus,
  RefreshCw,
  LayoutDashboard,
  BookmarkIcon,
  StickyNote,
  History,
  Settings,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.5-1.7 4.4-5.5 4.4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12s4.2 9.3 9.3 9.3c5.4 0 8.9-3.8 8.9-9.1 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "").trim();
  if (!src) return "U";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || src[0].toUpperCase();
}

export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const startGoogle = async (forcePicker: boolean) => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/",
        extraParams: forcePicker ? { prompt: "select_account" } : undefined,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Tokens received and session set
      setOpen(false);
      setBusy(false);
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    // Supabase supports a single active session — sign out, then prompt Google
    // to let the user choose a different account.
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    await startGoogle(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    toast.success("Signed out");
  };

  // Avatar trigger
  const avatarUrl =
    (user?.user_metadata as Record<string, unknown> | undefined)?.avatar_url as string | undefined ||
    (user?.user_metadata as Record<string, unknown> | undefined)?.picture as string | undefined;
  const displayName =
    ((user?.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined) ||
    ((user?.user_metadata as Record<string, unknown> | undefined)?.name as string | undefined) ||
    user?.email ||
    "";
  const initials = getInitials(displayName, user?.email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={user ? "Account menu" : "Sign in"}
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-sm text-foreground transition hover:border-primary/40 hover:bg-accent disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : user ? (
          avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold">{initials}</span>
          )
        ) : (
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl backdrop-blur">
          {user ? (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold">{initials}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {displayName}
                  </div>
                  {user.email && displayName !== user.email && (
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  )}
                </div>
              </div>

              <nav className="py-1 text-sm">
                <MenuLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Insights" onClick={() => setOpen(false)} />
                <MenuLink to="/library" icon={<BookmarkIcon className="h-4 w-4" />} label="Library" onClick={() => setOpen(false)} />
                <MenuLink to="/notes" icon={<StickyNote className="h-4 w-4" />} label="Notes" onClick={() => setOpen(false)} />
                <MenuLink to="/history" icon={<History className="h-4 w-4" />} label="History" onClick={() => setOpen(false)} />
                <MenuLink to="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => setOpen(false)} />
              </nav>

              <div className="border-t border-border/60 py-1 text-sm">
                <MenuButton
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Switch account"
                  onClick={handleSwitchAccount}
                  disabled={busy}
                />
                <MenuButton
                  icon={<UserPlus className="h-4 w-4" />}
                  label="Add another account"
                  onClick={handleSwitchAccount}
                  disabled={busy}
                />
                <MenuButton
                  icon={<LogOut className="h-4 w-4" />}
                  label="Sign out"
                  onClick={handleSignOut}
                />
              </div>
            </>
          ) : (
            <div className="p-4">
              <div className="text-sm font-semibold text-foreground">Welcome to ZenTube</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign in with Google to save notes, history, and personal insights. No new password to remember.
              </p>
              <button
                onClick={() => startGoogle(false)}
                disabled={busy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Sign in with Google
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                You'll stay signed in on this device. Your data only lives in your account.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to, icon, label, onClick,
}: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 text-foreground/90 transition-colors hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MenuButton({
  icon, label, onClick, disabled,
}: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-foreground/90 transition-colors hover:bg-accent disabled:opacity-50"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
