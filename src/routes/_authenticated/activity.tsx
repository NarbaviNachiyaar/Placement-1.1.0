import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, History, ShieldAlert } from "lucide-react";
import { db } from "@/lib/data/client";
import { usePermissions } from "@/lib/auth";
import { exportCsv, exportExcel } from "@/lib/export";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { canViewActivityLogs, canExportActivityLogs } = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewActivityLogs) {
      setLoading(false);
      return;
    }
    db
      .from("activity_logs")
      .select("id,user_email,action,entity_type,details,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, [canViewActivityLogs]);

  function exportRows(format: "csv" | "excel") {
    const shaped = rows.map((r) => ({
      Timestamp: new Date(r.created_at).toLocaleString(),
      User: r.user_email ?? "system",
      Action: r.action,
      Entity: r.entity_type ?? "",
      Details: r.details ?? "",
    }));
    const filename = `activity-log-${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCsv(shaped, filename);
    else exportExcel(shaped, filename);
  }

  if (!canViewActivityLogs) {
    return (
      <>
        <PageHeader title="Activity log" description="Who did what, and when." />
        <EmptyState
          icon={ShieldAlert}
          title="Restricted"
          description="Only Super Admins can view the activity log."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Who did what, and when."
        actions={
          canExportActivityLogs && rows.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  <Download className="mr-1.5 size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportRows("csv")}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("excel")}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
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
