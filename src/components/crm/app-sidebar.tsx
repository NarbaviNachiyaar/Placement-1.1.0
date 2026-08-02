import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  ListChecks,
  ClipboardList,
  BarChart3,
  Users,
  History,
  Trash2,
  Settings,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/followups", label: "Follow-ups", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/team", label: "Team", icon: Users },
  { to: "/activity", label: "Activity Log", icon: History },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isSuperAdmin } = usePermissions();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="gradient-brand flex size-10 items-center justify-center rounded-xl shadow-elevated">
          <GraduationCap className="size-5 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Placement CRM</p>
          <p className="text-xs text-muted-foreground">T&amp;P Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "gradient-brand text-primary-foreground shadow-elevated"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {isSuperAdmin && (
          <Link
            to="/trash"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === "/trash"
                ? "gradient-brand text-primary-foreground shadow-elevated"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Trash2 className="size-4" />
            Trash
          </Link>
        )}

        <Link
          to="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
            pathname === "/settings"
              ? "gradient-brand text-primary-foreground shadow-elevated"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </nav>

      <div className="m-3 rounded-2xl border border-sidebar-border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <p className="text-xs font-semibold">Placement drive season</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Keep follow-ups current so no recruiter goes cold.
        </p>
      </div>
    </aside>
  );
}
