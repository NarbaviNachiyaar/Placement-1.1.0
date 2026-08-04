import { useEffect, useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import {
  FOLLOWUP_STATUSES,
  MODES,
  MODE_LABEL,
  PRIORITIES,
  titleCase,
  type FollowupStatus,
  type Mode,
  type Priority,
} from "@/lib/crm";
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
import { VoiceNoteField } from "./voice-note-field";

export type FollowupRecord = {
  id: string;
  company_id: string;
  followup_date: string;
  followup_time: string | null;
  mode: Mode;
  priority: Priority;
  status: FollowupStatus;
  message: string | null;
  voice_transcript: string | null;
  assigned_to: string | null;
  created_by?: string | null;
  next_followup_date: string | null;
  next_followup_time: string | null;
};

type Member = { id: string; full_name: string | null; email: string };

export function FollowupDialog({
  open,
  onOpenChange,
  companyId,
  companies,
  followup,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId?: string;
  companies?: { id: string; name: string }[];
  followup?: FollowupRecord | null;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: companyId ?? "",
    followup_date: new Date().toISOString().slice(0, 10),
    followup_time: "10:00",
    mode: "call" as Mode,
    priority: "medium" as Priority,
    status: "pending" as FollowupStatus,
    message: "",
    voice_transcript: "",
    assigned_to: "",
    next_followup_date: "",
    next_followup_time: "",
  });

  useEffect(() => {
    db
      .from("profiles")
      .select("id,full_name,email")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm({
      company_id: followup?.company_id ?? companyId ?? "",
      followup_date: followup?.followup_date ?? new Date().toISOString().slice(0, 10),
      followup_time: followup?.followup_time?.slice(0, 5) ?? "10:00",
      mode: followup?.mode ?? "call",
      priority: followup?.priority ?? "medium",
      status: followup?.status ?? "pending",
      message: followup?.message ?? "",
      voice_transcript: followup?.voice_transcript ?? "",
      assigned_to: followup?.assigned_to ?? user?.id ?? "",
      next_followup_date: followup?.next_followup_date ?? "",
      next_followup_time: followup?.next_followup_time?.slice(0, 5) ?? "",
    });
  }, [open, followup, companyId, user?.id]);

  async function save() {
    if (!form.company_id) {
      toast.error("Choose a company first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: form.company_id,
        followup_date: form.followup_date,
        followup_time: form.followup_time || null,
        mode: form.mode,
        priority: form.priority,
        status: form.status,
        message: form.message || null,
        voice_transcript: form.voice_transcript || null,
        assigned_to: form.assigned_to || null,
        next_followup_date: form.next_followup_date || null,
        next_followup_time: form.next_followup_time || null,
        completed_at: form.status === "completed" ? new Date().toISOString() : null,
      };

      if (followup) {
        const { error } = await db.from("followups").update(payload).eq("id", followup.id);
        if (error) throw error;
        toast.success("Follow-up updated");
      } else {
        const { error } = await db
          .from("followups")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        if (form.assigned_to && form.assigned_to !== user?.id) {
          await notify({
            userId: form.assigned_to,
            title: "New follow-up assigned",
            body: `${MODE_LABEL[form.mode]} scheduled for ${form.followup_date}`,
            type: "followup",
          });
        }
        toast.success("Follow-up scheduled");
      }
      await logActivity({
        userId: user?.id,
        userEmail: user?.email,
        action: followup ? "Followup Updated" : "Followup Added",
        entityType: "followup",
        companyId: form.company_id,
        details: `${MODE_LABEL[form.mode]} on ${form.followup_date}`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{followup ? "Edit follow-up" : "Add follow-up"}</DialogTitle>
          <DialogDescription>
            Log the interaction, capture a voice note, and schedule the next touchpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {companies && (
            <div>
              <Label>Company</Label>
              <Select
                value={form.company_id}
                onValueChange={(v) => setForm({ ...form, company_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
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
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fdate">Date</Label>
              <Input
                id="fdate"
                type="date"
                value={form.followup_date}
                onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ftime">Time</Label>
              <Input
                id="ftime"
                type="time"
                value={form.followup_time}
                onChange={(e) => setForm({ ...form, followup_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as Mode })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {titleCase(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as FollowupStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {titleCase(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned member</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => setForm({ ...form, assigned_to: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="msg">Message / summary</Label>
            <Textarea
              id="msg"
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>

          <VoiceNoteField
            value={form.voice_transcript}
            onChange={(v) => setForm({ ...form, voice_transcript: v })}
          />

          <div className="grid gap-4 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ndate">Next follow-up date</Label>
              <Input
                id="ndate"
                type="date"
                value={form.next_followup_date}
                onChange={(e) => setForm({ ...form, next_followup_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ntime">Next follow-up time</Label>
              <Input
                id="ntime"
                type="time"
                value={form.next_followup_time}
                onChange={(e) => setForm({ ...form, next_followup_time: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
