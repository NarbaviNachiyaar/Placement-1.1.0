import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlarmClock,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Download,
  ListTodo,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_TONE,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  titleCase,
} from "@/lib/crm";
import { isOverdue, taskAbilities, visibleTasks, type TaskRecord } from "@/lib/tasks";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";
import { EmptyState, ListSkeleton, PageHeader, StatCard } from "@/components/crm/ui-kit";
import { TaskDialog, type Assignee, type CompanyOption } from "@/components/crm/task-dialog";
import { TaskDetailSheet } from "@/components/crm/task-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Placement CRM" },
      {
        name: "description",
        content:
          "Assign, track and review placement cell tasks with deadlines, priorities and workload insights.",
      },
      { property: "og:title", content: "Tasks — Placement CRM" },
      {
        property: "og:description",
        content:
          "Assign, track and review placement cell tasks with deadlines, priorities and workload insights.",
      },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { user, role } = useAuth();
  const abilities = taskAbilities(role, user?.id);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [members, setMembers] = useState<Assignee[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [active, setActive] = useState<TaskRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: p }, { data: c }] = await Promise.all([
      db.from("tasks").select("*").order("deadline", { ascending: true }),
      db.from("profiles").select("id,full_name,email").order("full_name", { ascending: true }),
      db.from("companies").select("id,name").is("deleted_at", null).order("name", { ascending: true }),
    ]);
    setTasks((t as unknown as TaskRecord[]) ?? []);
    setMembers((p as unknown as Assignee[]) ?? []);
    setCompanies((c as unknown as CompanyOption[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const memberName = (id: string | null) => {
    if (!id) return "—";
    const m = members.find((x) => x.id === id);
    return m?.full_name || m?.email || "Unknown";
  };
  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? null) : null;

  const scoped = useMemo(() => visibleTasks(tasks, role, user?.id), [tasks, role, user?.id]);

  const filtered = useMemo(
    () =>
      scoped.filter((t) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.department ?? "").toLowerCase().includes(q);
        return (
          matchesQuery &&
          (status === "all" || t.status === status) &&
          (priority === "all" || t.priority === priority) &&
          (assignee === "all" || t.assigned_to === assignee)
        );
      }),
    [scoped, query, status, priority, assignee],
  );

  const today = new Date().toDateString();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const stats = useMemo(() => {
    const assignedToday = scoped.filter(
      (t) => new Date(t.created_at).toDateString() === today,
    ).length;
    const pending = scoped.filter((t) => t.status === "pending" || t.status === "in_progress").length;
    const completed = scoped.filter((t) => t.status === "completed").length;
    const overdue = scoped.filter(isOverdue).length;
    const dueThisWeek = scoped.filter(
      (t) =>
        t.deadline &&
        t.status !== "completed" &&
        new Date(t.deadline) >= new Date(today) &&
        new Date(t.deadline) <= weekEnd,
    ).length;
    const productivity = scoped.length ? Math.round((completed / scoped.length) * 100) : 0;
    return { assignedToday, pending, completed, overdue, dueThisWeek, productivity };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped]);

  const workload = useMemo(() => {
    const map = new Map<string, { open: number; done: number; overdue: number }>();
    scoped.forEach((t) => {
      if (!t.assigned_to) return;
      const entry = map.get(t.assigned_to) ?? { open: 0, done: 0, overdue: 0 };
      if (t.status === "completed") entry.done += 1;
      else entry.open += 1;
      if (isOverdue(t)) entry.overdue += 1;
      map.set(t.assigned_to, entry);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].open - a[1].open);
  }, [scoped]);

  const exportRows = () =>
    filtered.map((t) => ({
      Title: t.title,
      "Assigned By": memberName(t.assigned_by),
      "Assigned To": memberName(t.assigned_to),
      Department: t.department ?? "",
      Company: companyName(t.company_id) ?? "",
      Priority: titleCase(t.priority),
      Status: TASK_STATUS_LABEL[t.status],
      Progress: `${t.progress}%`,
      Deadline: t.deadline ?? "",
      Created: new Date(t.created_at).toLocaleDateString(),
      Completed: t.completed_at ? new Date(t.completed_at).toLocaleDateString() : "",
    }));

  function openTask(task: TaskRecord) {
    setActive(task);
    setSheetOpen(true);
  }

  async function refresh() {
    await load();
    setActive((prev) => {
      if (!prev) return prev;
      return prev;
    });
  }

  useEffect(() => {
    if (!active) return;
    const updated = tasks.find((t) => t.id === active.id);
    if (updated && updated !== active) setActive(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description={
          abilities.readOnly
            ? "Read-only view of the work assigned across the placement cell."
            : `${filtered.length} of ${scoped.length} tasks`
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  <Download className="mr-1.5 size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCsv(exportRows(), "tasks")}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel(exportRows(), "tasks")}>
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPdf(exportRows(), "tasks", "Tasks")}>
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {abilities.canCreate && (
              <Button
                className="rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" /> New task
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Assigned today" value={stats.assignedToday} icon={ClipboardList} index={0} />
        <StatCard label="Pending" value={stats.pending} icon={ListTodo} tone="info" index={1} />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          tone="success"
          index={2}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={AlarmClock}
          tone="destructive"
          index={3}
        />
        <StatCard
          label="Due this week"
          value={stats.dueThisWeek}
          icon={CalendarRange}
          tone="warning"
          index={4}
        />
        <StatCard
          label="Team productivity"
          value={`${stats.productivity}%`}
          icon={CheckCircle2}
          tone="success"
          hint="Completed vs total tasks"
          index={5}
        />
      </div>

      <div className="glass flex flex-col gap-3 rounded-2xl p-4 shadow-soft lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, description or department…"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full rounded-xl lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-10 w-full rounded-xl lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {titleCase(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!abilities.readOnly && (
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-10 w-full rounded-xl lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => openTask(t)}
              className="glass rounded-2xl p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{t.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {memberName(t.assigned_to)}
                    {t.department ? ` · ${t.department}` : ""}
                    {companyName(t.company_id) ? ` · ${companyName(t.company_id)}` : ""}
                  </p>
                </div>
                <Badge className={cn("shrink-0 border-0", TASK_STATUS_TONE[t.status])}>
                  {TASK_STATUS_LABEL[t.status]}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className={cn("border-0", TASK_PRIORITY_TONE[t.priority])}>
                  {titleCase(t.priority)}
                </Badge>
                {t.deadline && (
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isOverdue(t) ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    Due {t.deadline}
                    {isOverdue(t) ? " · overdue" : ""}
                  </span>
                )}
                {t.review_status === "pending" && <Badge variant="outline">Awaiting review</Badge>}
                {t.extension_requested && <Badge variant="outline">Extension requested</Badge>}
              </div>

              <div className="mt-3 space-y-1.5">
                <Progress value={t.progress} />
                <p className="text-[11px] text-muted-foreground">{t.progress}% complete</p>
              </div>

              {abilities.canEdit && (
                <span
                  role="button"
                  tabIndex={0}
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(t);
                    setDialogOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setEditing(t);
                      setDialogOpen(true);
                    }
                  }}
                >
                  Edit / reassign
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ListTodo}
          title="No tasks found"
          description="Adjust your filters or create a new task for the team."
          action={
            abilities.canCreate ? (
              <Button
                className="rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" /> New task
              </Button>
            ) : null
          }
        />
      )}

      {abilities.canReview && workload.length > 0 && (
        <div className="glass rounded-2xl p-4 shadow-soft">
          <p className="text-sm font-semibold">Team workload</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {workload.map(([id, w]) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="truncate font-medium">{memberName(id)}</span>
                <span className="text-muted-foreground">
                  {w.open} open · {w.done} done
                  {w.overdue ? ` · ${w.overdue} overdue` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        members={members}
        companies={companies}
        onSaved={async () => {
          await load();
          toast.dismiss();
        }}
      />
      <TaskDetailSheet
        task={active}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        memberName={memberName}
        companyName={companyName}
        onChanged={refresh}
      />
    </>
  );
}
