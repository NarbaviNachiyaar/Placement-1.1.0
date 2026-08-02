import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/crm/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Placement CRM" },
      { name: "description", content: "Update your profile details and appearance preferences." },
      { property: "og:title", content: "Settings — Placement CRM" },
      {
        property: "og:description",
        content: "Update your profile details and appearance preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, role, refresh, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({ full_name: "", department: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? "",
      department: profile?.department ?? "",
      phone: profile?.phone ?? "",
    });
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await db
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        department: form.department.trim() || null,
        phone: form.phone.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Profile updated");
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile and workspace preferences." />

      <section className="glass max-w-2xl space-y-4 rounded-2xl p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Profile</h2>
          {role && <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>}
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile?.email ?? ""} disabled className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            className="mt-1.5"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dept">Department</Label>
            <Input
              id="dept"
              className="mt-1.5"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <Button className="rounded-xl" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="glass max-w-2xl space-y-3 rounded-2xl p-6 shadow-soft">
        <h2 className="text-sm font-bold">Appearance</h2>
        <div className="max-w-xs">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            <SelectTrigger className="mt-1.5 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </>
  );
}
