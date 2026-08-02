import { db } from "@/lib/data/client";

export async function logActivity(params: {
  userId: string | undefined;
  userEmail: string | undefined;
  action: string;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  details?: string;
}) {
  if (!params.userId) return;
  await db.from("activity_logs").insert({
    user_id: params.userId,
    user_email: params.userEmail ?? null,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    company_id: params.companyId ?? null,
    details: params.details ?? null,
  });
}

export async function notify(params: {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  link?: string;
}) {
  await db.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    body: params.body ?? null,
    type: params.type ?? "info",
    link: params.link ?? null,
  });
}
