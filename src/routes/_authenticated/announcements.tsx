import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { PageHeader, EmptyState } from "@/components/crm/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Placement CRM" },
      { name: "description", content: "Share achievements and updates with the whole team." },
    ],
  }),
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

function AnnouncementsPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  async function load() {
    const { data } = await db
      .from("announcements")
      .select("id,author_id,content,created_at,profiles(full_name,email)")
      .order("created_at", { ascending: false });
    setPosts((data as unknown as Announcement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function post() {
    if (!user || !draft.trim()) return;
    setPosting(true);
    const { error } = await db.from("announcements").insert({
      author_id: user.id,
      content: draft.trim(),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setDraft("");
    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: "Posted announcement",
    });
    void load();
  }

  async function remove(id: string) {
    const { error } = await db.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Announcement removed");
    void load();
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Share achievements, updates, and wins with the whole team."
      />

      <div className="glass max-w-2xl space-y-3 rounded-2xl p-5 shadow-soft">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share something with the team…"
          className="min-h-[80px] resize-none rounded-xl"
        />
        <div className="flex justify-end">
          <Button className="rounded-xl" onClick={() => void post()} disabled={posting || !draft.trim()}>
            <Send className="mr-1.5 size-4" /> Post
          </Button>
        </div>
      </div>

      <div className="max-w-2xl space-y-3">
        {loading ? null : posts.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Be the first to share something with the team."
          />
        ) : (
          posts.map((p) => {
            const name = p.profiles?.full_name ?? p.profiles?.email ?? "Someone";
            const canDelete = p.author_id === user?.id || isSuperAdmin;
            return (
              <div key={p.id} className="glass flex gap-3 rounded-2xl p-4 shadow-soft">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{name}</p>
                    <div className="flex items-center gap-2">
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()}
                      </p>
                      {canDelete && (
                        <button
                          onClick={() => void remove(p.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete announcement"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{p.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
