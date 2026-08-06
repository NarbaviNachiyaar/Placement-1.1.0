import { useState } from "react";
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
  Megaphone,
  MessageSquare,
  Trash2,
  Settings,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/followups", label: "Follow-ups", icon: ListChecks },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isSuperAdmin, isManager } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  function linkClass(active: boolean) {
    return cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
      collapsed && "justify-center px-0",
      active
        ? "gradient-brand text-primary-foreground shadow-elevated"
        : "text-sidebar-foreground hover:bg-sidebar-accent",
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-3 px-5 py-5", collapsed && "justify-center px-2")}>
        <div className="gradient-brand flex size-10 shrink-0 items-center justify-center rounded-xl shadow-elevated">
          <GraduationCap className="size-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight">Placement CRM</p>
            <p className="truncate text-xs text-muted-foreground">T&amp;P Command Center</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-xl border border-sidebar-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={linkClass(active)}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Team roster (with everyone's personal details) is Super Admin +
            Admin only — Faculty/Coordinator/Viewer never see it. */}
        {isManager && (
          <Link
            to="/team"
            onClick={onNavigate}
            className={linkClass(pathname === "/team" || pathname.startsWith("/team/"))}
            title={collapsed ? "Team" : undefined}
          >
            <Users className="size-4 shrink-0" />
            {!collapsed && "Team"}
          </Link>
        )}

        {isSuperAdmin && (
          <Link
            to="/trash"
            onClick={onNavigate}
            className={linkClass(pathname === "/trash")}
            title={collapsed ? "Trash" : undefined}
          >
            <Trash2 className="size-4 shrink-0" />
            {!collapsed && "Trash"}
          </Link>
        )}

        {isSuperAdmin && (
          <Link
            to="/activity"
            onClick={onNavigate}
            className={linkClass(pathname === "/activity")}
            title={collapsed ? "Activity Log" : undefined}
          >
            <History className="size-4 shrink-0" />
            {!collapsed && "Activity Log"}
          </Link>
        )}

        <Link
          to="/settings"
          onClick={onNavigate}
          className={linkClass(pathname === "/settings")}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="size-4 shrink-0" />
          {!collapsed && "Settings"}
        </Link>
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-2xl border border-sidebar-border bg-gradient-to-br from-primary/10 to-transparent p-4">
          <p className="text-xs font-semibold">Placement drive season</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep follow-ups current so no recruiter goes cold.
          </p>
        </div>
      )}

      <div className="border-t border-sidebar-border px-3 py-3 text-center text-[11px] text-muted-foreground">
        {collapsed ? "NN" : "Made by Narbavi Nachiyaar"}
      </div>
    </aside>
  );
}
