import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  titleCase,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/crm";
import type { TaskRecord } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Assignee = { id: string; full_name: string | null; email: string; role?: string };
export type CompanyOption = { id: string; name: string };

const EMPTY = {
  title: "",
  description: "",
  assigned_to: "",
  department: "",
  priority: "medium" as TaskPriority,
  status: "pending" as TaskStatus,
  deadline: "",
  company_id: "",
  progress: 0,
};

export function TaskDialog({
  open,
  onOpenChange,
  task,
  members,
  companies,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: TaskRecord | null;
  members: Assignee[];
  companies: CompanyOption[];
  onSaved: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      task
        ? {
            title: task.title,
            description: task.description ?? "",
            assigned_to: task.assigned_to ?? "",
            department: task.department ?? "",
            priority: task.priority,
            status: task.status,
            deadline: task.deadline ?? "",
            company_id: task.company_id ?? "",
            progress: task.progress ?? 0,
          }
        : EMPTY,
    );
  }, [open, task]);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save() {
    if (!values.title.trim()) return toast.error("Task title is required");
    if (!values.assigned_to) return toast.error("Assign the task to a team member");
    setBusy(true);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      assigned_to: values.assigned_to,
      department: values.department || null,
      priority: values.priority,
      status: values.status,
      progress: Number(values.progress) || 0,
      deadline: values.deadline || null,
      company_id: values.company_id || null,
      completed_at: values.status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const reassigned = task && task.assigned_to !== values.assigned_to;

    const { error } = task
      ? await db.from("tasks").update(payload).eq("id", task.id)
      : await db.from("tasks").insert({
          ...payload,
          assigned_by: user?.id ?? null,
          review_status: "none",
          extension_requested: false,
          extension_reason: null,
          created_at: new Date().toISOString(),
        });

    setBusy(false);
    if (error) return toast.error(error.message);

    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: task ? (reassigned ? "Task Reassigned" : "Task Updated") : "Task Assigned",
      entityType: "task",
      entityId: task?.id,
      companyId: values.company_id || undefined,
      details: values.title.trim(),
    });

    if (!task || reassigned) {
      await notify({
        userId: values.assigned_to,
        title: task ? "A task was reassigned to you" : "New task assigned",
        body: values.title.trim(),
        type: "task",
        link: "/tasks",
      });
    } else {
      await notify({
        userId: values.assigned_to,
        title: "Task updated",
        body: values.title.trim(),
        type: "task",
        link: "/tasks",
      });
    }

    toast.success(task ? "Task saved" : "Task created");
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            Assign placement work with a clear owner, deadline and priority.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="task-title">Task title</Label>
            <Input
              id="task-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Prepare campus drive logistics"
              className="mt-1.5 h-10 rounded-xl"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What exactly needs to be done?"
              className="mt-1.5 min-h-24 rounded-xl"
            />
          </div>

          <div>
            <Label>Assign to</Label>
            <Select value={values.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Department</Label>
            <Select value={values.department} onValueChange={(v) => set("department", v)}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Priority</Label>
            <Select
              value={values.priority}
              onValueChange={(v) => set("priority", v as TaskPriority)}
            >
              <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {titleCase(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => set("status", v as TaskStatus)}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="task-deadline">Deadline</Label>
            <Input
              id="task-deadline"
              type="date"
              value={values.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className="mt-1.5 h-10 rounded-xl"
            />
          </div>

          <div>
            <Label>Company</Label>
            <Select value={values.company_id} onValueChange={(v) => set("company_id", v)}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={() => void save()} disabled={busy}>
            {task ? "Save task" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
