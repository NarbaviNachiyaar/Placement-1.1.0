import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImagePlus, Megaphone, Send, Trash2, X } from "lucide-react";
import { db } from "@/lib/data/client";
import { supabase } from "@/lib/supabase";
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Announcement = {
  id: string;
  author_id: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

function AnnouncementsPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await db
      .from("announcements")
      .select("id,author_id,content,image_url,created_at,profiles(full_name,email)")
      .order("created_at", { ascending: false });
    setPosts((data as unknown as Announcement[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function pickImage(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Please choose a JPG, PNG, GIF, or WEBP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large — max 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function post() {
    if (!user || !draft.trim()) return;
    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const path = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("announcement-images")
          .upload(path, imageFile);
        if (uploadError) throw new Error(uploadError.message);
        const { data: pub } = supabase.storage.from("announcement-images").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }

      const { error } = await db.from("announcements").insert({
        author_id: user.id,
        content: draft.trim(),
        image_url: imageUrl,
      });
      if (error) throw new Error(error.message);

      setDraft("");
      clearImage();
      await logActivity({ userId: user.id, userEmail: user.email, action: "Posted announcement" });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post announcement");
    } finally {
      setPosting(false);
    }
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

        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="max-h-48 rounded-xl border object-cover" />
            <button
              onClick={clearImage}
              className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow-elevated"
              title="Remove image"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="mr-1.5 size-4" /> Add image
          </Button>
          <Button className="rounded-xl" onClick={() => void post()} disabled={posting || !draft.trim()}>
            <Send className="mr-1.5 size-4" /> {posting ? "Posting…" : "Post"}
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
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt=""
                      className="mt-2 max-h-80 rounded-xl border object-cover"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
