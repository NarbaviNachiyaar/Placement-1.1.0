import { db } from "@/lib/data/client";

export type ConversationType = "dm" | "group" | "department" | "company";

export type ConversationRow = {
  id: string;
  type: ConversationType;
  title: string | null;
  department: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Finds an existing 1:1 conversation between two users, or creates one. */
export async function getOrCreateDM(userId: string, otherUserId: string) {
  const { data: mine } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  const mineIds = ((mine as { conversation_id: string }[]) ?? []).map((r) => r.conversation_id);

  if (mineIds.length) {
    const { data: theirs } = await db
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", mineIds);
    const sharedIds = ((theirs as { conversation_id: string }[]) ?? []).map((r) => r.conversation_id);
    if (sharedIds.length) {
      const { data: dm } = await db
        .from("conversations")
        .select("*")
        .eq("type", "dm")
        .in("id", sharedIds)
        .limit(1)
        .maybeSingle();
      if (dm) return dm as ConversationRow;
    }
  }

  const { data: created, error } = await db
    .from("conversations")
    .insert({ type: "dm", created_by: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await db.from("conversation_participants").insert([
    { conversation_id: created.id, user_id: userId },
    { conversation_id: created.id, user_id: otherUserId },
  ]);
  return created as ConversationRow;
}

export async function createGroup(userId: string, title: string, memberIds: string[]) {
  const { data: created, error } = await db
    .from("conversations")
    .insert({ type: "group", title, created_by: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const uniqueMembers = Array.from(new Set([userId, ...memberIds]));
  await db.from("conversation_participants").insert(
    uniqueMembers.map((user_id) => ({ conversation_id: created.id, user_id })),
  );
  return created as ConversationRow;
}

/** Department chats are shared by everyone in that department — auto-join on open. */
export async function getOrCreateDepartmentChat(userId: string, department: string) {
  let { data: convo } = await db
    .from("conversations")
    .select("*")
    .eq("type", "department")
    .eq("department", department)
    .maybeSingle();

  if (!convo) {
    const { data: created, error } = await db
      .from("conversations")
      .insert({ type: "department", department, title: department, created_by: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    convo = created;
  }

  const { data: existingMembership } = await db
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", convo!.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existingMembership) {
    await db.from("conversation_participants").insert({ conversation_id: convo!.id, user_id: userId });
  }
  return convo as ConversationRow;
}

/** Company discussion threads — anyone who opens a company's thread joins it. */
export async function getOrCreateCompanyThread(userId: string, companyId: string, companyName: string) {
  let { data: convo } = await db
    .from("conversations")
    .select("*")
    .eq("type", "company")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!convo) {
    const { data: created, error } = await db
      .from("conversations")
      .insert({ type: "company", company_id: companyId, title: companyName, created_by: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    convo = created;
  }

  const { data: existingMembership } = await db
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", convo!.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existingMembership) {
    await db.from("conversation_participants").insert({ conversation_id: convo!.id, user_id: userId });
  }
  return convo as ConversationRow;
}

export async function markRead(conversationId: string, userId: string) {
  await db
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}
