import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import {
  MODE_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  titleCase,
  type CompanyStatus,
  type Mode,
  type Priority,
} from "@/lib/crm";
import { PageHeader, StatCard, CardsSkeleton, EmptyState } from "@/components/crm/ui-kit";
import { CompanyDialog } from "@/components/crm/company-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Placement CRM" },
      {
        name: "description",
        content: "Live placement pipeline: companies, pending follow-ups and drive conversion.",
      },
      { property: "og:title", content: "Dashboard — Placement CRM" },
      {
        property: "og:description",
        content: "Live placement pipeline: companies, pending follow-ups and drive conversion.",
      },
    ],
  }),
  component: DashboardPage,
});

type CompanyRow = {
  id: string;
  name: string;
  status: CompanyStatus;
  industry: string | null;
  updated_at: string;
};
type FollowupRow = {
  id: string;
  company_id: string;
  followup_date: string;
  followup_time: string | null;
  mode: Mode;
  priority: Priority;
  status: string;
  message: string | null;
  companies?: { name: string } | null;
};

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function DashboardPage() {
  const { profile } = useAuth();
  const { canCreate } = usePermissions();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [followups, setFollowups] = useState<FollowupRow[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: f }, { count }] = await Promise.all([
      db
        .from("companies")
        .select("id,name,status,industry,updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      db
        .from("followups")
        .select("id,company_id,followup_date,followup_time,mode,priority,status,message,companies(name)")
        .order("followup_date", { ascending: true })
        .limit(200),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setCompanies((c as CompanyRow[]) ?? []);
    setFollowups((f as unknown as FollowupRow[]) ?? []);
    setTeamCount(count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const pending = followups.filter((f) => f.status === "pending");
  const todays = pending.filter((f) => f.followup_date === today);
  const overdue = pending.filter((f) => f.followup_date < today);
  const upcoming = pending.filter((f) => f.followup_date > today).slice(0, 6);
  const drives = companies.filter((c) => c.status === "campus_drive" || c.status === "hired");

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => map.set(c.status, (map.get(c.status) ?? 0) + 1));
    return Array.from(map, ([status, value]) => ({
      name: STATUS_LABEL[status as CompanyStatus] ?? titleCase(status),
      value,
    }));
  }, [companies]);

  const industryData = useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach((c) => map.set(c.industry ?? "Unspecified", (map.get(c.industry ?? "Unspecified") ?? 0) + 1));
    return Array.from(map, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [companies]);

  return (
    <>
      <PageHeader
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Your placement pipeline at a glance."
        actions={
          canCreate ? (
            <Button onClick={() => setDialogOpen(true)} className="rounded-xl">
              <Plus className="mr-1.5 size-4" /> Add company
            </Button>
          ) : null
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Companies" value={companies.length} icon={Building2} index={0} />
            <StatCard
              label="Today's follow-ups"
              value={todays.length}
              icon={CalendarClock}
              tone="info"
              index={1}
            />
            <StatCard
              label="Overdue"
              value={overdue.length}
              icon={Clock}
              tone="destructive"
              index={2}
            />
            <StatCard
              label="Campus drives"
              value={drives.length}
              icon={CheckCircle2}
              tone="success"
              index={3}
            />
            <StatCard label="Team members" value={teamCount} icon={Users} tone="warning" index={4} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass rounded-2xl p-5 shadow-soft">
              <h2 className="text-sm font-bold">Pipeline by status</h2>
              <div className="mt-4 h-64">
                {statusData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {statusData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="pt-16 text-center text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusData.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-5 shadow-soft">
              <h2 className="text-sm font-bold">Top industries</h2>
              <div className="mt-4 h-64">
                {industryData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={industryData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={50} angle={-20} textAnchor="end" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-1)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="pt-16 text-center text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FollowupList title="Overdue & today" items={[...overdue, ...todays]} tone="destructive" />
            <FollowupList title="Upcoming" items={upcoming} tone="muted" />
          </div>

          <section className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Recently updated companies</h2>
              <Link to="/companies" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            {companies.length ? (
              <ul className="mt-4 divide-y">
                {companies.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: c.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    <Badge className={cn("shrink-0 border-0", STATUS_TONE[c.status])}>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={TrendingUp}
                  title="No companies yet"
                  description="Add your first recruiter to start tracking outreach."
                />
              </div>
            )}
          </section>
        </>
      )}

      <CompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </>
  );
}

function FollowupList({
  title,
  items,
  tone,
}: {
  title: string;
  items: FollowupRow[];
  tone: "destructive" | "muted";
}) {
  return (
    <section className="glass rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        <Link to="/followups" className="text-xs font-semibold text-primary hover:underline">
          View all
        </Link>
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-2">
          {items.slice(0, 6).map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <Link
                  to="/companies/$companyId"
                  params={{ companyId: f.company_id }}
                  className="block truncate text-sm font-medium hover:text-primary"
                >
                  {f.companies?.name ?? "Company"}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {MODE_LABEL[f.mode]} · {f.followup_date}
                  {f.followup_time ? ` · ${f.followup_time.slice(0, 5)}` : ""}
                </p>
              </div>
              <Badge className={cn("shrink-0 border-0", PRIORITY_TONE[f.priority])}>
                {titleCase(f.priority)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={cn(
            "mt-6 text-center text-sm",
            tone === "destructive" ? "text-success" : "text-muted-foreground",
          )}
        >
          {tone === "destructive" ? "Nothing overdue. Great work!" : "No upcoming follow-ups."}
        </p>
      )}
    </section>
  );
}
