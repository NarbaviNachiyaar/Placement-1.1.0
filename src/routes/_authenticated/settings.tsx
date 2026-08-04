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

const EMPTY_FORM = {
  full_name: "",
  department: "",
  phone: "",
  alternate_phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  date_of_birth: "",
  gender: "",
  emergency_contact: "",
  blood_group: "",
  joining_date: "",
  designation: "",
  student_id: "",
  roll_number: "",
  course: "",
  academic_year: "",
  semester: "",
  section: "",
  batch: "",
  parent_name: "",
  parent_phone: "",
  parent_email: "",
  hostel_or_day_scholar: "",
  faculty_mentor: "",
};

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      department: profile.department ?? "",
      phone: profile.phone ?? "",
      alternate_phone: profile.alternate_phone ?? "",
      address: profile.address ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      country: profile.country ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      gender: profile.gender ?? "",
      emergency_contact: profile.emergency_contact ?? "",
      blood_group: profile.blood_group ?? "",
      joining_date: profile.joining_date ?? "",
      designation: profile.designation ?? "",
      student_id: profile.student_id ?? "",
      roll_number: profile.roll_number ?? "",
      course: profile.course ?? "",
      academic_year: profile.academic_year ?? "",
      semester: profile.semester ?? "",
      section: profile.section ?? "",
      batch: profile.batch ?? "",
      parent_name: profile.parent_name ?? "",
      parent_phone: profile.parent_phone ?? "",
      parent_email: profile.parent_email ?? "",
      hostel_or_day_scholar: profile.hostel_or_day_scholar ?? "",
      faculty_mentor: profile.faculty_mentor ?? "",
    });
  }, [profile]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]),
    );
    const { error } = await db.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Profile updated");
  }

  const isCoordinator = role === "coordinator";

  return (
    <>
      <PageHeader title="Settings" description="Your profile and workspace preferences." />

      <section className="glass max-w-3xl space-y-4 rounded-2xl p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Profile</h2>
          {role && <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>}
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile?.email ?? ""} disabled className="mt-1.5" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              className="mt-1.5"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              className="mt-1.5"
              value={form.designation}
              onChange={(e) => set("designation", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dept">Department</Label>
            <Input
              id="dept"
              className="mt-1.5"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="alt-phone">Alternate phone</Label>
            <Input
              id="alt-phone"
              className="mt-1.5"
              value={form.alternate_phone}
              onChange={(e) => set("alternate_phone", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="emergency">Emergency contact</Label>
            <Input
              id="emergency"
              className="mt-1.5"
              value={form.emergency_contact}
              onChange={(e) => set("emergency_contact", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              className="mt-1.5"
              value={form.date_of_birth}
              onChange={(e) => set("date_of_birth", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Input
              id="gender"
              className="mt-1.5"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="blood">Blood group</Label>
            <Input
              id="blood"
              className="mt-1.5"
              value={form.blood_group}
              onChange={(e) => set("blood_group", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="joining">Joining date</Label>
            <Input
              id="joining"
              type="date"
              className="mt-1.5"
              value={form.joining_date}
              onChange={(e) => set("joining_date", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            className="mt-1.5"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              className="mt-1.5"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              className="mt-1.5"
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              className="mt-1.5"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
        </div>

        {isCoordinator && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-bold">Student / Coordinator details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="student-id">Student ID</Label>
                <Input
                  id="student-id"
                  className="mt-1.5"
                  value={form.student_id}
                  onChange={(e) => set("student_id", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="roll">Roll number</Label>
                <Input
                  id="roll"
                  className="mt-1.5"
                  value={form.roll_number}
                  onChange={(e) => set("roll_number", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="course">Course</Label>
                <Input
                  id="course"
                  className="mt-1.5"
                  value={form.course}
                  onChange={(e) => set("course", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  className="mt-1.5"
                  value={form.academic_year}
                  onChange={(e) => set("academic_year", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="semester">Semester</Label>
                <Input
                  id="semester"
                  className="mt-1.5"
                  value={form.semester}
                  onChange={(e) => set("semester", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  className="mt-1.5"
                  value={form.section}
                  onChange={(e) => set("section", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="batch">Batch</Label>
                <Input
                  id="batch"
                  className="mt-1.5"
                  value={form.batch}
                  onChange={(e) => set("batch", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="hostel">Hostel / Day scholar</Label>
                <Input
                  id="hostel"
                  className="mt-1.5"
                  value={form.hostel_or_day_scholar}
                  onChange={(e) => set("hostel_or_day_scholar", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mentor">Faculty mentor</Label>
                <Input
                  id="mentor"
                  className="mt-1.5"
                  value={form.faculty_mentor}
                  onChange={(e) => set("faculty_mentor", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parent-name">Parent name</Label>
                <Input
                  id="parent-name"
                  className="mt-1.5"
                  value={form.parent_name}
                  onChange={(e) => set("parent_name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parent-phone">Parent phone</Label>
                <Input
                  id="parent-phone"
                  className="mt-1.5"
                  value={form.parent_phone}
                  onChange={(e) => set("parent_phone", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parent-email">Parent email</Label>
                <Input
                  id="parent-email"
                  className="mt-1.5"
                  value={form.parent_email}
                  onChange={(e) => set("parent_email", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <Button className="rounded-xl" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="glass max-w-3xl space-y-3 rounded-2xl p-6 shadow-soft">
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
