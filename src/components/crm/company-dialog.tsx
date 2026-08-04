import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  COMPANY_SIZES,
  COMPANY_STATUSES,
  COMPANY_TYPES,
  INDUSTRIES,
  RECRUITER_TYPES,
  RECRUITER_TYPE_LABEL,
  SCHOOLS,
  STATUS_LABEL,
  type CompanyStatus,
  type RecruiterType,
} from "@/lib/crm";
import { Checkbox } from "@/components/ui/checkbox";
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

const schema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  company_size: z.string().optional().or(z.literal("")),
  company_type: z.string().optional().or(z.literal("")),
  recruiter_type: z.enum(RECRUITER_TYPES),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.enum(COMPANY_STATUSES),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  campus_drive_date: z.string().optional().or(z.literal("")),
  hr_name: z.string().trim().max(120).optional().or(z.literal("")),
  hr_designation: z.string().trim().max(120).optional().or(z.literal("")),
  hr_email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  hr_phone: z.string().trim().max(30).optional().or(z.literal("")),
  hr_linkedin: z.string().trim().max(200).optional().or(z.literal("")),
  hr_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CompanyFormValues = z.infer<typeof schema>;

export type CompanyRecord = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  company_type: string | null;
  recruiter_type?: string | null;
  linkedin: string | null;
  status: CompanyStatus;
  description: string | null;
  campus_drive_date: string | null;
};

export function CompanyDialog({
  open,
  onOpenChange,
  company,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: CompanyRecord | null;
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: "new", recruiter_type: "company" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: company?.name ?? "",
      website: company?.website ?? "",
      industry: company?.industry ?? "",
      location: company?.location ?? "",
      company_size: company?.company_size ?? "",
      company_type: company?.company_type ?? "",
      recruiter_type: (company?.recruiter_type as RecruiterType) ?? "company",
      linkedin: company?.linkedin ?? "",
      status: company?.status ?? "new",
      description: company?.description ?? "",
      campus_drive_date: company?.campus_drive_date ?? "",
      hr_name: "",
      hr_designation: "",
      hr_email: "",
      hr_phone: "",
      hr_linkedin: "",
      hr_notes: "",
    });
    if (company?.id) {
      db.from("company_departments")
        .select("department")
        .eq("company_id", company.id)
        .then(({ data }) => {
          setDepartments(((data as { department: string }[]) ?? []).map((d) => d.department));
        });
    } else {
      setDepartments([]);
    }
  }, [open, company]);

  function toggleDepartment(dept: string) {
    setDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  }

  async function onSubmit(values: CompanyFormValues) {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        website: values.website || null,
        industry: values.industry || null,
        location: values.location || null,
        company_size: values.company_size || null,
        company_type: values.company_type || null,
        recruiter_type: values.recruiter_type,
        linkedin: values.linkedin || null,
        status: values.status,
        description: values.description || null,
        campus_drive_date: values.campus_drive_date || null,
      };

      let companyId = company?.id;
      if (companyId) {
        const { error } = await db.from("companies").update(payload).eq("id", companyId);
        if (error) throw error;
        await logActivity({
          userId: user?.id,
          userEmail: user?.email,
          action: "Company Updated",
          entityType: "company",
          entityId: companyId,
          companyId,
          details: values.name,
        });
        toast.success("Company updated");
      } else {
        const { data, error } = await db
          .from("companies")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        companyId = data?.id as string;
        if (values.hr_name) {
          await db.from("contacts").insert({
            company_id: companyId,
            name: values.hr_name,
            designation: values.hr_designation || null,
            email: values.hr_email || null,
            phone: values.hr_phone || null,
            linkedin: values.hr_linkedin || null,
            notes: values.hr_notes || null,
            is_primary: true,
            created_by: user?.id,
          });
        }
        await logActivity({
          userId: user?.id,
          userEmail: user?.email,
          action: "Company Created",
          entityType: "company",
          entityId: companyId,
          companyId,
          details: values.name,
        });
        toast.success("Company added");
      }

      // Sync department mappings: replace whatever was there with the
      // currently checked set.
      await db.from("company_departments").delete().eq("company_id", companyId);
      if (departments.length) {
        await db.from("company_departments").insert(
          departments.map((department) => ({ company_id: companyId, department })),
        );
      }

      onOpenChange(false);
      onSaved?.(companyId!);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save company");
    } finally {
      setSaving(false);
    }
  }

  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
          <DialogDescription>
            {company
              ? "Update recruiter details. Timestamps are saved automatically."
              : "Capture the company profile and its primary HR contact."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" {...form.register("name")} placeholder="Acme Technologies" />
              {err.name && <p className="mt-1 text-xs text-destructive">{err.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input id="website" {...form.register("website")} placeholder="https://acme.com" />
            </div>
            <div>
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" {...form.register("linkedin")} placeholder="linkedin.com/company/acme" />
            </div>
            <div>
              <Label>Industry</Label>
              <Select
                value={form.watch("industry") || ""}
                onValueChange={(v) => form.setValue("industry", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...form.register("location")} placeholder="Bengaluru, India" />
            </div>
            <div>
              <Label>Company size</Label>
              <Select
                value={form.watch("company_size") || ""}
                onValueChange={(v) => form.setValue("company_size", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company type</Label>
              <Select
                value={form.watch("company_type") || ""}
                onValueChange={(v) => form.setValue("company_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recruiter type</Label>
              <Select
                value={form.watch("recruiter_type")}
                onValueChange={(v) => form.setValue("recruiter_type", v as RecruiterType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recruiter type" />
                </SelectTrigger>
                <SelectContent>
                  {RECRUITER_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECRUITER_TYPE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Departments / schools recruited for</Label>
              <div className="mt-1.5 grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                {SCHOOLS.map((school) => (
                  <label
                    key={school}
                    className="flex items-center gap-2 text-sm font-normal"
                  >
                    <Checkbox
                      checked={departments.includes(school)}
                      onCheckedChange={() => toggleDepartment(school)}
                    />
                    {school}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as CompanyStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="campus_drive_date">Campus drive date</Label>
              <Input id="campus_drive_date" type="date" {...form.register("campus_drive_date")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...form.register("description")} />
            </div>
          </section>

          {!company && (
            <section className="space-y-4 rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm font-semibold">Primary HR contact</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="hr_name">HR name</Label>
                  <Input id="hr_name" {...form.register("hr_name")} />
                </div>
                <div>
                  <Label htmlFor="hr_designation">Designation</Label>
                  <Input id="hr_designation" {...form.register("hr_designation")} />
                </div>
                <div>
                  <Label htmlFor="hr_email">Email</Label>
                  <Input id="hr_email" type="email" {...form.register("hr_email")} />
                  {err.hr_email && (
                    <p className="mt-1 text-xs text-destructive">{err.hr_email.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="hr_phone">Phone</Label>
                  <Input id="hr_phone" {...form.register("hr_phone")} />
                </div>
                <div>
                  <Label htmlFor="hr_linkedin">LinkedIn</Label>
                  <Input id="hr_linkedin" {...form.register("hr_linkedin")} />
                </div>
                <div>
                  <Label htmlFor="hr_notes">Additional notes</Label>
                  <Input id="hr_notes" {...form.register("hr_notes")} />
                </div>
              </div>
            </section>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : company ? "Save changes" : "Save company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
