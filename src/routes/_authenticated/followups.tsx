import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import {
  MODE_LABEL,
  PRIORITY_TONE,
  titleCase,
  type FollowupStatus,
  type Mode,
  type Priority,
} from "@/lib/crm";
import { logActivity } from "@/lib/activity";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { FollowupDialog, type FollowupRecord } from "@/components/crm/followup-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/followups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Placement CRM" },
      {
        name: "description",
        content: "Every scheduled call, email and meeting with recruiters in one queue.",
      },
      { property: "og:title", content: "Follow-ups — Placement CRM" },
      {
        property: "og:description",
        content: "Every scheduled call, email and meeting with recruiters in one queue.",
      },
    ],
  }),
  component: FollowupsPage,
});

type Row = FollowupRecord & { companies?: { name: string } | null };

function FollowupsPage() {
  const { user } = useAuth();
  const { canCreate } = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FollowupRecord | null>(null);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: c }] = await Promise.all([
      db
        .from("followups")
        .select(
          "id,company_id,followup_date,followup_time,mode,priority,status,message,voice_transcript,assigned_to,next_followup_date,next_followup_time,companies(name)",
        )
        .order("followup_date", { ascending: true }),
      db.from("companies").select("id,name").is("deleted_at", null).order("name"),
    ]);
    if (error) toast.error(error.message);
    setRows((data as unknown as Row[]) ?? []);
    setCompanies((c as { id: string; name: string }[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    if (tab === "today") return rows.filter((r) => r.status === "pending" && r.followup_date === today);
    if (tab === "overdue") return rows.filter((r) => r.status === "pending" && r.followup_date < today);
    if (tab === "upcoming") return rows.filter((r) => r.status === "pending" && r.followup_date > today);
    if (tab === "mine") return rows.filter((r) => r.assigned_to === user?.id && r.status === "pending");
    if (tab === "completed") return rows.filter((r) => r.status === "completed");
    return rows;
  }, [rows, tab, today, user?.id]);

  async function complete(row: Row) {
    const { error } = await db
      .from("followups")
      .update({ status: "completed" as FollowupStatus, completed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Followup Completed",
      entityType: "followup",
      entityId: row.id,
      companyId: row.company_id,
    });
    toast.success("Marked as completed");
    void load();
  }

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Track every recruiter touchpoint and never miss a callback."
        actions={
          canCreate ? (
            <Button
              className="rounded-xl"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Add follow-up
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="mine">Assigned to me</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length ? (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="glass flex flex-col gap-3 rounded-2xl p-4 shadow-soft sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: r.company_id }}
                    className="text-sm font-bold hover:text-primary"
                  >
                    {r.companies?.name ?? "Company"}
                  </Link>
                  <Badge className={cn("border-0", PRIORITY_TONE[r.priority as Priority])}>
                    {titleCase(r.priority)}
                  </Badge>
                  <Badge variant="outline">{MODE_LABEL[r.mode as Mode]}</Badge>
                  {r.status !== "pending" && <Badge variant="secondary">{titleCase(r.status)}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.followup_date}
                  {r.followup_time ? ` · ${r.followup_time.slice(0, 5)}` : ""}
                </p>
                {r.message && <p className="mt-2 line-clamp-2 text-sm">{r.message}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {canCreate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setEditing(r);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {r.status === "pending" && canCreate && (
                  <Button size="sm" className="rounded-lg" onClick={() => void complete(r)}>
                    <CheckCircle2 className="mr-1.5 size-4" /> Done
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="Nothing here"
          description="No follow-ups match this view."
        />
      )}

      <FollowupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companies={companies}
        followup={editing}
        onSaved={load}
      />
    </>
  );
}
