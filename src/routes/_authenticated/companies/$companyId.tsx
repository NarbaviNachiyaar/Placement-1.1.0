import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  MODE_LABEL,
  PRIORITY_TONE,
  RECRUITER_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  titleCase,
  type CompanyStatus,
  type Mode,
  type RecruiterType,
  type Priority,
} from "@/lib/crm";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { CompanyAssignees } from "@/components/crm/company-assignees";
import { CompanyDialog } from "@/components/crm/company-dialog";
import { FollowupDialog, type FollowupRecord } from "@/components/crm/followup-dialog";
import { VoiceNoteField } from "@/components/crm/voice-note-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/companies/$companyId")({
  head: () => ({
    meta: [
      { title: "Company details — Placement CRM" },
      {
        name: "description",
        content: "HR contacts, follow-up history and notes for this recruiter.",
      },
      { property: "og:title", content: "Company details — Placement CRM" },
      {
        property: "og:description",
        content: "HR contacts, follow-up history and notes for this recruiter.",
      },
    ],
  }),
  component: CompanyDetail,
});

type Company = {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  status: CompanyStatus;
  company_type: string | null;
  recruiter_type: string | null;
  company_size: string | null;
  description: string | null;
  linkedin: string | null;
  campus_drive_date: string | null;
};
type Contact = {
  id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};
type Followup = FollowupRecord;
type Note = { id: string; content: string; created_at: string; created_by: string | null };

function CompanyDetail() {
  const { companyId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreate, canDeleteCompanies, canAddNotes } = usePermissions();

  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<FollowupRecord | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: ct }, { data: f }, { data: n }, { data: cd }] = await Promise.all([
      db.from("companies").select("*").eq("id", companyId).maybeSingle(),
      db
        .from("contacts")
        .select("id,name,designation,email,phone,is_primary")
        .eq("company_id", companyId)
        .order("is_primary", { ascending: false }),
      db
        .from("followups")
        .select(
          "id,company_id,followup_date,followup_time,mode,priority,status,message,voice_transcript,assigned_to,next_followup_date,next_followup_time",
        )
        .eq("company_id", companyId)
        .order("followup_date", { ascending: false }),
      db
        .from("notes")
        .select("id,content,created_at,created_by")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      db.from("company_departments").select("department").eq("company_id", companyId),
    ]);
    setCompany((c as Company) ?? null);
    setContacts((ct as Contact[]) ?? []);
    setFollowups((f as unknown as Followup[]) ?? []);
    setNotes((n as Note[]) ?? []);
    setDepartments(((cd as { department: string }[]) ?? []).map((d) => d.department));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function softDelete() {
    const { error } = await db
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", companyId);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Company Deleted",
      entityType: "company",
      companyId,
      details: company?.name,
    });
    toast.success("Moved to trash");
    navigate({ to: "/companies" });
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    const { error } = await db
      .from("notes")
      .insert({ company_id: companyId, content: noteDraft.trim(), created_by: user?.id });
    if (error) return toast.error(error.message);
    setNoteDraft("");
    toast.success("Note added");
    void load();
  }

  if (loading) return <ListSkeleton rows={6} />;
  if (!company)
    return (
      <EmptyState
        icon={Building2}
        title="Company not found"
        description="It may have been deleted or you don't have access."
        action={
          <Button asChild className="rounded-xl">
            <Link to="/companies">Back to companies</Link>
          </Button>
        }
      />
    );

  return (
    <>
      <Link
        to="/companies"
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All companies
      </Link>

      <PageHeader
        title={company.name}
        description={[company.industry, company.location].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {canCreate && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setEditingFollowup(null);
                  setFollowupOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" /> Follow-up
              </Button>
            )}
            {canCreate && (
              <Button className="rounded-xl" onClick={() => setEditOpen(true)}>
                Edit company
              </Button>
            )}
            {canDeleteCompanies && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Move {company.name} to trash?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You can restore it later from the Trash page.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void softDelete()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        }
      />

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow-soft">
        <Badge className={cn("border-0", STATUS_TONE[company.status])}>
          {STATUS_LABEL[company.status]}
        </Badge>
        {company.company_type && <Badge variant="outline">{company.company_type}</Badge>}
        {company.recruiter_type && company.recruiter_type !== "company" && (
          <Badge variant="outline">
            {RECRUITER_TYPE_LABEL[company.recruiter_type as RecruiterType] ?? company.recruiter_type}
          </Badge>
        )}
        {company.company_size && <Badge variant="outline">{company.company_size} employees</Badge>}
        {departments.map((d) => (
          <Badge key={d} variant="secondary">
            {d}
          </Badge>
        ))}
        {company.location && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> {company.location}
          </span>
        )}
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Globe className="size-3.5" /> Website
          </a>
        )}
      </div>

      {company.description && (
        <p className="text-sm text-muted-foreground">{company.description}</p>
      )}

      <CompanyAssignees companyId={companyId} />

      <Tabs defaultValue="followups">
        <TabsList>
          <TabsTrigger value="followups">Follow-ups ({followups.length})</TabsTrigger>
          <TabsTrigger value="contacts">HR contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="followups" className="mt-4 space-y-3">
          {followups.length ? (
            followups.map((f) => (
              <div key={f.id} className="glass rounded-2xl p-4 shadow-soft">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{MODE_LABEL[f.mode as Mode]}</Badge>
                  <Badge className={cn("border-0", PRIORITY_TONE[f.priority as Priority])}>
                    {titleCase(f.priority)}
                  </Badge>
                  <Badge variant="secondary">{titleCase(f.status)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {f.followup_date}
                    {f.followup_time ? ` · ${f.followup_time.slice(0, 5)}` : ""}
                  </span>
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setEditingFollowup(f);
                        setFollowupOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                {f.message && <p className="mt-2 text-sm">{f.message}</p>}
                {f.voice_transcript && (
                  <p className="mt-2 rounded-xl bg-muted/50 p-3 text-xs italic text-muted-foreground">
                    “{f.voice_transcript}”
                  </p>
                )}
                {f.next_followup_date && (
                  <p className="mt-2 text-xs font-medium text-primary">
                    Next: {f.next_followup_date}
                    {f.next_followup_time ? ` · ${f.next_followup_time.slice(0, 5)}` : ""}
                  </p>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Plus}
              title="No follow-ups yet"
              description="Log your first interaction with this recruiter."
            />
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 grid gap-3 md:grid-cols-2">
          {contacts.length ? (
            contacts.map((c) => (
              <div key={c.id} className="glass rounded-2xl p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-primary" />
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.is_primary && <Badge variant="secondary">Primary</Badge>}
                </div>
                {c.designation && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.designation}</p>
                )}
                <div className="mt-3 space-y-1.5 text-xs">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <Mail className="size-3.5" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary">
                      <Phone className="size-3.5" /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2">
              <EmptyState icon={UserRound} title="No HR contacts" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          {canAddNotes && (
            <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
              <VoiceNoteField
                value={noteDraft}
                onChange={setNoteDraft}
                label="Add a note"
              />
              <Button className="rounded-xl" onClick={() => void addNote()} disabled={!noteDraft.trim()}>
                Save note
              </Button>
            </div>
          )}
          {notes.length ? (
            notes.map((n) => (
              <div key={n.id} className="glass rounded-2xl p-4 shadow-soft">
                <p className="text-sm">{n.content}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <EmptyState icon={StickyNote} title="No notes yet" />
          )}
        </TabsContent>
      </Tabs>

      <CompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
        onSaved={load}
      />
      <FollowupDialog
        open={followupOpen}
        onOpenChange={setFollowupOpen}
        companyId={companyId}
        followup={editingFollowup}
        onSaved={load}
      />
    </>
  );
}
