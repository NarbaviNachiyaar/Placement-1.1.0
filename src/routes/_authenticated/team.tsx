import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions, ROLE_LABEL, type AppRole } from "@/lib/auth";
import { ROLES } from "@/lib/crm";
import { logActivity } from "@/lib/activity";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Placement CRM" },
      { name: "description", content: "Invite approved members and manage placement cell roles." },
      { property: "og:title", content: "Team — Placement CRM" },
      {
        property: "og:description",
        content: "Invite approved members and manage placement cell roles.",
      },
    ],
  }),
  component: TeamPage,
});

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  is_active: boolean;
  last_login: string | null;
};
type Approved = { id: string; email: string; role: AppRole; created_at: string };

function TeamPage() {
  const { user } = useAuth();
  const { canInvite, isSuperAdmin } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [approved, setApproved] = useState<Approved[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("coordinator");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: a }] = await Promise.all([
      db
        .from("profiles")
        .select("id,email,full_name,department,is_active,last_login")
        .order("full_name"),
      db.from("user_roles").select("user_id,role"),
      db.from("approved_users").select("id,email,role,created_at").order("created_at", {
        ascending: false,
      }),
    ]);
    setMembers((p as Member[]) ?? []);
    const map: Record<string, AppRole> = {};
    ((r as unknown as { user_id: string; role: AppRole }[]) ?? []).forEach((x) => (map[x.user_id] = x.role));
    setRoles(map);
    setApproved((a as Approved[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite() {
    const parsed = z.string().trim().email().max(200).safeParse(inviteEmail);
    if (!parsed.success) return toast.error("Enter a valid email address");
    setBusy(true);
    const { error } = await db
      .from("approved_users")
      .insert({ email: parsed.data.toLowerCase(), role: inviteRole, invited_by: user?.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Member Invited",
      entityType: "approved_user",
      details: `${parsed.data} as ${ROLE_LABEL[inviteRole]}`,
    });
    toast.success("Member approved — they can now sign in with OTP");
    setInviteEmail("");
    setOpen(false);
    void load();
  }

  async function changeRole(userId: string, role: AppRole) {
    const { error } = await db
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    setRoles((prev) => ({ ...prev, [userId]: role }));
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Role Changed",
      entityType: "user_role",
      entityId: userId,
      details: ROLE_LABEL[role],
    });
    toast.success("Role updated");
  }

  async function revoke(id: string, email: string) {
    const { error } = await db.from("approved_users").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Access revoked for ${email}`);
    void load();
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Approved members and their access levels."
        actions={
          canInvite ? (
            <Button className="rounded-xl" onClick={() => setOpen(true)}>
              <UserPlus className="mr-1.5 size-4" /> Invite member
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="approved">Approved emails</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          {loading ? (
            <ListSkeleton />
          ) : members.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {members.map((m) => (
                <li key={m.id} className="glass flex items-center gap-3 rounded-2xl p-4 shadow-soft">
                  <Avatar>
                    <AvatarFallback>
                      {(m.full_name ?? m.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.full_name ?? m.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    {m.department && (
                      <p className="truncate text-[11px] text-muted-foreground">{m.department}</p>
                    )}
                  </div>
                  {canInvite && m.id !== user?.id ? (
                    <Select
                      value={roles[m.id] ?? "viewer"}
                      onValueChange={(v) => void changeRole(m.id, v as AppRole)}
                    >
                      <SelectTrigger className="w-40 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{ROLE_LABEL[roles[m.id] ?? "viewer"]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title="No members yet" />
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {approved.length ? (
            <ul className="glass divide-y rounded-2xl p-2 shadow-soft">
              {approved.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{a.email}</span>
                  <Badge variant="outline">{ROLE_LABEL[a.role]}</Badge>
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => void revoke(a.id, a.email)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Plus}
              title="No approved emails"
              description="Invite a member to whitelist their email for OTP sign-in."
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              Whitelist an email so they can sign in with a one-time code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@institute.edu"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void invite()} disabled={busy}>
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
