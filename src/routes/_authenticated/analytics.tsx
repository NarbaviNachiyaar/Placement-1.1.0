import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, CheckCircle2, PhoneCall, Target } from "lucide-react";
import { db } from "@/lib/data/client";
import { MODE_LABEL, STATUS_LABEL, type CompanyStatus, type Mode } from "@/lib/crm";
import { PageHeader, StatCard, CardsSkeleton } from "@/components/crm/ui-kit";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Placement CRM" },
      {
        name: "description",
        content: "Response rates, outreach volume, industry mix and drive conversion insights.",
      },
      { property: "og:title", content: "Analytics — Placement CRM" },
      {
        property: "og:description",
        content: "Response rates, outreach volume, industry mix and drive conversion insights.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type Company = { id: string; status: CompanyStatus; industry: string | null; created_at: string };
type Followup = { id: string; mode: Mode; status: string; followup_date: string };

function AnalyticsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.from("companies").select("id,status,industry,created_at").is("deleted_at", null),
      db.from("followups").select("id,mode,status,followup_date"),
    ]).then(([c, f]) => {
      setCompanies((c.data as Company[]) ?? []);
      setFollowups((f.data as Followup[]) ?? []);
      setLoading(false);
    });
  }, []);

  const responded = companies.filter(
    (c) => !["new", "contacted"].includes(c.status) && c.status !== "rejected",
  ).length;
  const responseRate = companies.length ? Math.round((responded / companies.length) * 100) : 0;
  const converted = companies.filter((c) => c.status === "campus_drive" || c.status === "hired").length;
  const conversion = companies.length ? Math.round((converted / companies.length) * 100) : 0;
  const completed = followups.filter((f) => f.status === "completed").length;

  const statusData = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => m.set(c.status, (m.get(c.status) ?? 0) + 1));
    return Array.from(m, ([k, value]) => ({ name: STATUS_LABEL[k as CompanyStatus], value }));
  }, [companies]);

  const modeData = useMemo(() => {
    const m = new Map<string, number>();
    followups.forEach((f) => m.set(f.mode, (m.get(f.mode) ?? 0) + 1));
    return Array.from(m, ([k, value]) => ({ name: MODE_LABEL[k as Mode], value }));
  }, [followups]);

  const monthlyData = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => {
      const key = c.created_at.slice(0, 7);
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [companies]);

  if (loading) return <CardsSkeleton />;

  return (
    <>
      <PageHeader title="Analytics" description="How your placement outreach is performing." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Companies tracked" value={companies.length} icon={Building2} index={0} />
        <StatCard label="Response rate" value={`${responseRate}%`} icon={Target} tone="info" index={1} />
        <StatCard
          label="Drive conversion"
          value={`${conversion}%`}
          icon={CheckCircle2}
          tone="success"
          index={2}
        />
        <StatCard
          label="Follow-ups completed"
          value={completed}
          icon={PhoneCall}
          tone="warning"
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5 shadow-soft">
          <h2 className="text-sm font-bold">Status distribution</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={95} label>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 shadow-soft">
          <h2 className="text-sm font-bold">Outreach by mode</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="glass rounded-2xl p-5 shadow-soft">
        <h2 className="text-sm font-bold">Companies added over time</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
