import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Pencil,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/lib/data/client";
import { supabase } from "@/lib/supabase";
import { useAuth, usePermissions } from "@/lib/auth";
import {
  createGroup,
  getOrCreateDM,
  markRead,
  type ConversationRow,
} from "@/lib/messaging";
import { PageHeader, EmptyState } from "@/components/crm/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Placement CRM" },
      { name: "description", content: "Team chat, department channels, and company threads." },
    ],
  }),
  component: MessagesPage,
});

const EMOJIS = ["😀", "😂", "👍", "🙏", "🎉", "🔥", "❤️", "✅", "👀", "🤔", "😅", "🚀"];

type Member = { id: string; full_name: string | null; email: string; department: string | null };
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};
type Participant = { user_id: string; last_read_at: string };
type ConversationWithMeta = ConversationRow & {
  participants: Participant[];
  lastMessage?: MessageRow;
  unread: number;
  otherMember?: Member;
};

function MessagesPage() {
  const { user, profile } = useAuth();
  const { isViewer, isSuperAdmin } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  async function loadMembers() {
    const { data } = await db.rpc("list_member_directory");
    const all = ((data as (Member & { role: string | null })[]) ?? []).filter(
      (m) => m.id !== user?.id,
    );
    // Viewers can only message Super Admin — everyone else can message
    // any active teammate.
    const visible = isViewer
      ? all.filter((m) => m.role === "super_admin" || m.role === "admin")
      : all;
    setMembers(visible);
  }

  async function loadConversations() {
    if (!user) return;
    const { data: mine } = await db
      .from("conversation_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", user.id);
    const ids = ((mine as { conversation_id: string; last_read_at: string }[]) ?? []).map(
      (r) => r.conversation_id,
    );
    if (!ids.length) {
      setConversations([]);
      return;
    }

    const [{ data: convos }, { data: parts }, { data: lastMsgs }] = await Promise.all([
      db.from("conversations").select("*").in("id", ids),
      db
        .from("conversation_participants")
        .select("conversation_id,user_id,last_read_at")
        .in("conversation_id", ids),
      db
        .from("messages")
        .select("id,conversation_id,sender_id,content,file_url,file_name,file_type,created_at,edited_at,deleted_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    const partsByConvo = new Map<string, Participant[]>();
    for (const p of (parts as { conversation_id: string; user_id: string; last_read_at: string }[]) ??
      []) {
      const list = partsByConvo.get(p.conversation_id) ?? [];
      list.push({ user_id: p.user_id, last_read_at: p.last_read_at });
      partsByConvo.set(p.conversation_id, list);
    }
    const lastByConvo = new Map<string, MessageRow>();
    for (const m of (lastMsgs as MessageRow[]) ?? []) {
      if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);
    }

    const enriched: ConversationWithMeta[] = ((convos as ConversationRow[]) ?? []).map((c) => {
      const participants = partsByConvo.get(c.id) ?? [];
      const mine = participants.find((p) => p.user_id === user.id);
      const lastMessage = lastByConvo.get(c.id);
      const convoMessages = ((lastMsgs as MessageRow[]) ?? []).filter(
        (m) => m.conversation_id === c.id,
      );
      const unread = mine
        ? convoMessages.filter(
            (m) => m.sender_id !== user.id && new Date(m.created_at) > new Date(mine.last_read_at),
          ).length
        : 0;
      const otherUserId =
        c.type === "dm" ? participants.find((p) => p.user_id !== user.id)?.user_id : undefined;
      return {
        ...c,
        participants,
        lastMessage,
        unread,
        otherMember: otherUserId ? members.find((m) => m.id === otherUserId) : undefined,
      };
    });

    enriched.sort((a, b) => {
      const at = a.lastMessage?.created_at ?? a.created_at;
      const bt = b.lastMessage?.created_at ?? b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
    setConversations(enriched);
  }

  async function loadMessages(conversationId: string) {
    const { data } = await db
      .from("messages")
      .select("id,conversation_id,sender_id,content,file_url,file_name,file_type,created_at,edited_at,deleted_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as MessageRow[]) ?? []);
    if (user) {
      await markRead(conversationId, user.id);
      void loadConversations();
    }
  }

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (members.length || user) void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, user]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Live message delivery for the open conversation.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageRow]);
          if (user) void markRead(activeId, user.id);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, user]);

  // Typing indicator via ephemeral broadcast — no table needed.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase.channel(`typing:${activeId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const name = payload.payload?.name as string;
        if (!name) return;
        setTypingUsers((prev) => Array.from(new Set([...prev, name])));
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== name));
        }, 2500);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function broadcastTyping() {
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { name: profile?.full_name ?? profile?.email ?? "Someone" },
    });
  }

  async function sendMessage() {
    if (!activeId || !user || !draft.trim()) return;
    setSending(true);
    try {
      const { error } = await db.from("messages").insert({
        conversation_id: activeId,
        sender_id: user.id,
        content: draft.trim(),
      });
      if (error) throw new Error(error.message);
      setDraft("");
      void loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(messageId: string) {
    if (!editDraft.trim()) return;
    const { error } = await db
      .from("messages")
      .update({ content: editDraft.trim(), edited_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: editDraft.trim(), edited_at: new Date().toISOString() }
          : m,
      ),
    );
    setEditingId(null);
    setEditDraft("");
    void loadConversations();
  }

  /** Soft delete — "unsend": content is cleared, a "message deleted"
   *  placeholder shows in its place, matching how most chat apps handle
   *  unsend rather than silently rewriting history. */
  async function unsendMessage(messageId: string) {
    const { error } = await db
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), content: null, file_url: null, file_name: null })
      .eq("id", messageId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deleted_at: new Date().toISOString(), content: null, file_url: null, file_name: null }
          : m,
      ),
    );
    void loadConversations();
  }

  async function uploadFile(file: File) {
    if (!activeId || !user) return;
    setSending(true);
    try {
      const path = `${activeId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(path, file);
      if (uploadError) throw new Error(uploadError.message);
      const { data: pub } = supabase.storage.from("message-attachments").getPublicUrl(path);
      const { error } = await db.from("messages").insert({
        conversation_id: activeId,
        sender_id: user.id,
        file_url: pub.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });
      if (error) throw new Error(error.message);
      void loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload file");
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startDM(otherUserId: string) {
    if (!user) return;
    const convo = await getOrCreateDM(user.id, otherUserId);
    await loadConversations();
    setActiveId(convo.id);
  }

  async function saveGroup() {
    if (!user || !groupTitle.trim() || groupMembers.length === 0) return;
    const convo = await createGroup(user.id, groupTitle.trim(), groupMembers);
    setGroupDialogOpen(false);
    setGroupTitle("");
    setGroupMembers([]);
    await loadConversations();
    setActiveId(convo.id);
  }

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const label = (c.type === "dm" ? c.otherMember?.full_name ?? c.otherMember?.email : c.title) ?? "";
      return (
        label.toLowerCase().includes(q) || (c.lastMessage?.content ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  function conversationLabel(c: ConversationWithMeta) {
    if (c.type === "dm") return c.otherMember?.full_name ?? c.otherMember?.email ?? "Direct message";
    return c.title ?? "Conversation";
  }

  function conversationIcon(c: ConversationWithMeta) {
    if (c.type === "company") return <Building2 className="size-4" />;
    if (c.type === "dm") return null;
    return <Users className="size-4" />;
  }

  function readReceipt(message: MessageRow) {
    if (!active || message.sender_id !== user?.id) return null;
    const readers = active.participants.filter(
      (p) => p.user_id !== user?.id && new Date(p.last_read_at) >= new Date(message.created_at),
    );
    if (!readers.length) return "Sent";
    return `Read by ${readers.length}`;
  }

  return (
    <>
      <PageHeader title="Messages" description="Team chat, department channels, and company threads." />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]" style={{ height: "calc(100vh - 220px)" }}>
        <div className="glass flex flex-col overflow-hidden rounded-2xl shadow-soft">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="h-9 rounded-lg pl-8 text-sm"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="size-9 shrink-0 rounded-lg">
                  <MessageSquarePlus className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Direct message</p>
                {members.slice(0, 8).map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => void startDM(m.id)}>
                    {m.full_name ?? m.email}
                  </DropdownMenuItem>
                ))}
                <div className="border-t p-1">
                  <DropdownMenuItem onClick={() => setGroupDialogOpen(true)}>+ New group</DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No conversations yet. Start one with the + button above.
              </p>
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-accent ${
                    activeId === c.id ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="text-xs">
                      {conversationIcon(c) ?? conversationLabel(c).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conversationLabel(c)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage?.content ??
                        (c.lastMessage?.file_name ? `📎 ${c.lastMessage.file_name}` : "No messages yet")}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">{c.unread}</Badge>
                  )}
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="glass flex flex-col overflow-hidden rounded-2xl shadow-soft">
          {!active ? (
            <EmptyState
              icon={MessageSquarePlus}
              title="Select a conversation"
              description="Pick a chat on the left, or start a new one."
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{conversationLabel(active)}</p>
                  <p className="text-xs text-muted-foreground">
                    {active.participants.length} member{active.participants.length === 1 ? "" : "s"}
                  </p>
                </div>
                {active.type !== "dm" && (
                  <Badge variant="outline" className="capitalize">
                    {active.type}
                  </Badge>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const senderName =
                    members.find((mem) => mem.id === m.sender_id)?.full_name ?? "Member";
                  const isEditing = editingId === m.id;

                  if (m.deleted_at) {
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[75%] rounded-2xl bg-muted/50 px-3.5 py-2 text-sm italic text-muted-foreground">
                          This message was deleted
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                      {mine && !isEditing && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="mr-1 self-center rounded-full p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                              <MoreVertical className="size-3.5 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-36 p-1">
                            {m.content && (
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditDraft(m.content ?? "");
                                }}
                              >
                                <Pencil className="size-3.5" /> Edit
                              </button>
                            )}
                            <button
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent"
                              onClick={() => void unsendMessage(m.id)}
                            >
                              <Trash2 className="size-3.5" /> Unsend
                            </button>
                          </PopoverContent>
                        </Popover>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine ? "gradient-brand text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {!mine && active.type !== "dm" && (
                          <p className="mb-0.5 text-[11px] font-semibold opacity-70">{senderName}</p>
                        )}
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <Textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="min-h-[60px] resize-none bg-background text-foreground"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditDraft("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => void saveEdit(m.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                            {m.file_url && (
                              <a
                                href={m.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 flex items-center gap-1.5 text-xs underline underline-offset-2"
                              >
                                <Paperclip className="size-3.5" /> {m.file_name ?? "Attachment"}
                              </a>
                            )}
                            <p
                              className={`mt-1 text-[10px] ${
                                mine ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {m.edited_at && " · edited"}
                              {mine && ` · ${readReceipt(m)}`}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {typingUsers.length > 0 && (
                  <p className="text-xs italic text-muted-foreground">
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
                  </p>
                )}
              </div>

              <div className="flex items-end gap-2 border-t p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file or image"
                >
                  <Paperclip className="size-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0" title="Emoji">
                      <Smile className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="grid grid-cols-6 gap-1">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          className="rounded-lg p-1.5 text-lg hover:bg-accent"
                          onClick={() => setDraft((d) => d + e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    broadcastTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Type a message…"
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl"
                />
                <Button
                  size="icon"
                  className="shrink-0 rounded-xl"
                  onClick={() => void sendMessage()}
                  disabled={sending || !draft.trim()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>Pick a name and the teammates to include.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(m.id)}
                    onChange={() =>
                      setGroupMembers((prev) =>
                        prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                      )
                    }
                  />
                  {m.full_name ?? m.email}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveGroup()} disabled={!groupTitle.trim() || !groupMembers.length}>
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
