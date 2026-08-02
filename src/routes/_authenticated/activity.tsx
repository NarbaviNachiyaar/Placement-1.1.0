import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { db } from "@/lib/data/client";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Placement CRM" },
      { name: "description", content: "Full audit trail of every change made by your team." },
      { property: "og:title", content: "Activity Log — Placement CRM" },
      {
        property: "og:description",
        content: "Full audit trail of every change made by your team.",
      },
    ],
  }),
  component: ActivityPage,
});

type Row = {
  id: string;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  details: string | null;
  created_at: string;
};

function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db
      .from("activity_logs")
      .select("id,user_email,action,entity_type,details,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <PageHeader title="Activity log" description="Who did what, and when." />
      {loading ? (
        <ListSkeleton />
      ) : rows.length ? (
        <ul className="glass divide-y rounded-2xl p-2 shadow-soft">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <Badge variant="outline" className="shrink-0">
                {r.action}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.details ?? r.entity_type ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">{r.user_email ?? "system"}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={History} title="No activity yet" description="Actions will appear here." />
      )}
    </>
  );
}
