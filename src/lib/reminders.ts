import { db } from "@/lib/data/client";
import { notify } from "@/lib/activity";

/**
 * Runs once per app load for the signed-in user. Checks their follow-ups and
 * tasks for anything overdue or due today, and creates a notification for
 * each — skipping ones already notified so it doesn't spam on every reload.
 */
export async function runReminderCheck(userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: followups }, { data: tasks }, { data: existing }] = await Promise.all([
    db
      .from("followups")
      .select("id,company_id,followup_date,message")
      .eq("assigned_to", userId)
      .eq("status", "pending")
      .lte("followup_date", today),
    db
      .from("tasks")
      .select("id,title,deadline")
      .eq("assigned_to", userId)
      .neq("status", "completed")
      .lte("deadline", today),
    db.from("notifications").select("link").eq("user_id", userId).eq("type", "reminder"),
  ]);

  const alreadyNotified = new Set(
    ((existing as { link: string | null }[]) ?? []).map((n) => n.link).filter(Boolean),
  );

  for (const f of (followups as { id: string; company_id: string; followup_date: string; message: string | null }[]) ?? []) {
    const link = `/companies/${f.company_id}`;
    const key = `followup:${f.id}`;
    if (alreadyNotified.has(key)) continue;
    const overdue = f.followup_date < today;
    await notify({
      userId,
      title: overdue ? "Follow-up overdue" : "Follow-up due today",
      body: f.message ?? undefined,
      type: "reminder",
      link: key,
    });
  }

  for (const t of (tasks as { id: string; title: string; deadline: string | null }[]) ?? []) {
    if (!t.deadline) continue;
    const key = `task:${t.id}`;
    if (alreadyNotified.has(key)) continue;
    const overdue = t.deadline < today;
    await notify({
      userId,
      title: overdue ? `Task overdue: ${t.title}` : `Task due today: ${t.title}`,
      type: "reminder",
      link: key,
    });
  }
}
