import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Clock, FileText, Paperclip, Upload } from "lucide-react";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import {
  TASK_PRIORITY_TONE,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  titleCase,
  type TaskStatus,
} from "@/lib/crm";
import { taskAbilities, type TaskAttachment, type TaskNote, type TaskRecord } from "@/lib/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { VoiceNoteField } from "./voice-note-field";
import { cn } from "@/lib/utils";

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  memberName,
  companyName,
  onChanged,
}: {
  task: TaskRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberName: (id: string | null) => string;
  companyName: (id: string | null) => string | null;
  onChanged: () => void | Promise<void>;
}) {
  const { user, role } = useAuth();
  const abilities = taskAbilities(role, user?.id, task);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [progress, setProgress] = useState(0);
  const [extensionReason, setExtensionReason] = useState("");

  async function loadChildren(taskId: string) {
    const [{ data: n }, { data: a }] = await Promise.all([
      db.from("task_notes").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      db
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
    ]);
    setNotes((n as unknown as TaskNote[]) ?? []);
    setAttachments((a as unknown as TaskAttachment[]) ?? []);
  }

  useEffect(() => {
    if (!task || !open) return;
    setProgress(task.progress ?? 0);
    setNoteDraft("");
    setExtensionReason(task.extension_reason ?? "");
    void loadChildren(task.id);
  }, [task, open]);

  if (!task) return null;

  async function patch(patchValues: Record<string, unknown>, action: string) {
    if (!task) return;
    const { error } = await db
      .from("tasks")
      .update({ ...patchValues, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action,
      entityType: "task",
      entityId: task.id,
      companyId: task.company_id ?? undefined,
      details: task.title,
    });
    await onChanged();
  }

  async function saveProgress(next: number) {
    await patch(
      { progress: next, status: next >= 100 ? "completed" : task!.status },
      "Task Updated",
    );
    toast.success("Progress updated");
  }

  async function changeStatus(status: TaskStatus) {
    await patch(
      {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        progress: status === "completed" ? 100 : task!.progress,
        review_status: status === "completed" ? "pending" : "none",
      },
      status === "completed" ? "Task Completed" : "Task Updated",
    );
    if (status === "completed" && task!.assigned_by) {
      await notify({
        userId: task!.assigned_by,
        title: "Task marked completed",
        body: task!.title,
        type: "task",
        link: "/tasks",
      });
    }
    toast.success(`Marked ${TASK_STATUS_LABEL[status].toLowerCase()}`);
  }

  async function review(decision: "approved" | "rejected") {
    await patch(
      {
        review_status: decision,
        status: decision === "rejected" ? "rejected" : "completed",
      },
      decision === "approved" ? "Task Approved" : "Task Rejected",
    );
    if (task!.assigned_to) {
      await notify({
        userId: task!.assigned_to,
        title: decision === "approved" ? "Task approved" : "Task rejected",
        body: task!.title,
        type: "task",
        link: "/tasks",
      });
    }
    toast.success(decision === "approved" ? "Task approved" : "Task sent back");
  }

  async function requestExtension() {
    if (!extensionReason.trim()) return toast.error("Add a reason for the extension");
    await patch(
      { extension_requested: true, extension_reason: extensionReason.trim(), status: "waiting" },
      "Deadline Extension Requested",
    );
    if (task!.assigned_by) {
      await notify({
        userId: task!.assigned_by,
        title: "Deadline extension requested",
        body: task!.title,
        type: "task",
        link: "/tasks",
      });
    }
    toast.success("Extension requested");
  }

  async function addNote() {
    if (!noteDraft.trim() || !task) return;
    const { error } = await db.from("task_notes").insert({
      task_id: task.id,
      content: noteDraft.trim(),
      created_by: user?.id ?? null,
      created_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    setNoteDraft("");
    await loadChildren(task.id);
    toast.success("Note added");
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !task) return;
    for (const file of Array.from(files)) {
      await db.from("task_attachments").insert({
        task_id: task.id,
        name: file.name,
        size: file.size,
        type: file.type || null,
        uploaded_by: user?.id ?? null,
        created_at: new Date().toISOString(),
      });
    }
    await loadChildren(task.id);
    toast.success(`${files.length} document(s) attached`);
  }

  const company = companyName(task.company_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">{task.title}</SheetTitle>
          <SheetDescription className="text-left">
            Assigned by {memberName(task.assigned_by)} to {memberName(task.assigned_to)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border-0", TASK_STATUS_TONE[task.status])}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
            <Badge className={cn("border-0", TASK_PRIORITY_TONE[task.priority])}>
              {titleCase(task.priority)}
            </Badge>
            {task.department && <Badge variant="outline">{task.department}</Badge>}
            {company && <Badge variant="secondary">{company}</Badge>}
            {task.review_status !== "none" && (
              <Badge variant="outline">Review: {titleCase(task.review_status)}</Badge>
            )}
          </div>

          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Deadline: {task.deadline ?? "—"}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Created: {new Date(task.created_at).toLocaleDateString()}
            </p>
            {task.completed_at && (
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                Completed: {new Date(task.completed_at).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
            {abilities.canUpdateProgress && (
              <>
                <Slider
                  value={[progress]}
                  max={100}
                  step={5}
                  onValueChange={(v) => setProgress(v[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-xl" onClick={() => void saveProgress(progress)}>
                    Save progress
                  </Button>
                  <Select value={task.status} onValueChange={(v) => void changeStatus(v as TaskStatus)}>
                    <SelectTrigger className="h-9 w-40 rounded-xl">
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
              </>
            )}
          </div>

          {abilities.canReview && task.review_status === "pending" && (
            <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
              <p className="text-sm font-semibold">Review completed work</p>
              <div className="flex gap-2">
                <Button size="sm" className="rounded-xl" onClick={() => void review("approved")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void review("rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}

          {task.extension_requested && (
            <p className="rounded-xl bg-warning/15 p-3 text-xs text-warning-foreground">
              Extension requested: {task.extension_reason}
            </p>
          )}

          {abilities.canRequestExtension && !task.extension_requested && (
            <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
              <p className="text-sm font-semibold">Request a deadline extension</p>
              <Textarea
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="Why do you need more time?"
                className="min-h-20 rounded-xl"
              />
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void requestExtension()}>
                Request extension
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" /> Notes ({notes.length})
            </p>
            {abilities.canAddNotes && (
              <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
                <VoiceNoteField value={noteDraft} onChange={setNoteDraft} label="Add a note" />
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={!noteDraft.trim()}
                  onClick={() => void addNote()}
                >
                  Save note
                </Button>
              </div>
            )}
            {notes.map((n) => (
              <div key={n.id} className="glass rounded-2xl p-3 shadow-soft">
                <p className="text-sm">{n.content}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {memberName(n.created_by)} · {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Paperclip className="size-4" /> Documents ({attachments.length})
            </p>
            {abilities.canUpload && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
                <Upload className="size-4" /> Upload documents
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void uploadFiles(e.target.files)}
                />
              </label>
            )}
            {attachments.map((a) => (
              <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-3 shadow-soft">
                <Paperclip className="size-4 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(a.size / 1024).toFixed(0)} KB · {memberName(a.uploaded_by)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
