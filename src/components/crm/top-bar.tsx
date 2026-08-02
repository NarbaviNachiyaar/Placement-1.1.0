import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check, LogOut, Menu, Moon, Search, Sun, User as UserIcon } from "lucide-react";
import { db } from "@/lib/data/client";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_LABEL, type CompanyStatus } from "@/lib/crm";

type SearchRow = { id: string; name: string; industry: string | null; status: CompanyStatus };
type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

export function TopBar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { profile, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const q = `%${query.trim()}%`;
      const { data } = await db
        .from("companies")
        .select("id,name,industry,status")
        .eq("is_deleted", false)
        .or(`name.ilike.${q},industry.ilike.${q},location.ilike.${q}`)
        .limit(8);
      setResults((data as SearchRow[]) ?? []);
      setOpen(true);
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  async function loadNotifications() {
    const { data } = await db
      .from("notifications")
      .select("id,title,body,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setNotifications((data as NotificationRow[]) ?? []);
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unread = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  async function markAllRead() {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await db.from("notifications").update({ is_read: true }).in("id", ids);
    void loadNotifications();
  }

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu className="size-5" />
      </Button>

      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search companies, industries, locations…"
          className="rounded-xl border-transparent bg-muted/70 pl-9"
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border bg-popover shadow-elevated">
            {results.map((r) => (
              <Link
                key={r.id}
                to="/companies/$companyId"
                params={{ companyId: r.id }}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-accent"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.industry ?? "—"} · {STATUS_LABEL[r.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <Check className="mr-1 size-3.5" /> Mark all read
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="border-b px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.is_read && <Badge className="shrink-0 text-[10px]">New</Badge>}
                </div>
                {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-accent">
            <Avatar className="size-8">
              <AvatarFallback className="gradient-brand text-xs font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold leading-tight">
                {profile?.full_name ?? profile?.email}
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {role ? ROLE_LABEL[role] : "—"}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{profile?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <UserIcon className="mr-2 size-4" /> Profile &amp; settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
