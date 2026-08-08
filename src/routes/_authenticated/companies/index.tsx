import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Download, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import {
  COMPANY_STATUSES,
  INDUSTRIES,
  STATUS_LABEL,
  STATUS_TONE,
  type CompanyStatus,
} from "@/lib/crm";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { CompanyDialog } from "@/components/crm/company-dialog";
import { BulkImportDialog } from "@/components/crm/bulk-import-dialog";
import { createCompanyAssignmentTask } from "@/lib/company-tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/companies/")({
  head: () => ({
    meta: [
      { title: "Companies — Placement CRM" },
      {
        name: "description",
        content: "Search, filter and export every recruiter in your placement pipeline.",
      },
      { property: "og:title", content: "Companies — Placement CRM" },
      {
        property: "og:description",
        content: "Search, filter and export every recruiter in your placement pipeline.",
      },
    ],
  }),
  component: CompaniesPage,
});

type Row = {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  status: CompanyStatus;
  website: string | null;
  company_type: string | null;
  created_at: string;
};

function CompaniesPage() {
  const { canCreate, canBulkImport } = usePermissions();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await db
      .from("companies")
      .select("id,name,industry,location,status,website,company_type,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.location ?? "").toLowerCase().includes(q) ||
          (r.industry ?? "").toLowerCase().includes(q);
        return (
          matchesQuery &&
          (status === "all" || r.status === status) &&
          (industry === "all" || r.industry === industry)
        );
      }),
    [rows, query, status, industry],
  );

  const exportRows = () =>
    filtered.map((r) => ({
      Name: r.name,
      Industry: r.industry ?? "",
      Location: r.location ?? "",
      Status: STATUS_LABEL[r.status],
      Type: r.company_type ?? "",
      Website: r.website ?? "",
      Added: new Date(r.created_at).toLocaleDateString(),
    }));

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${filtered.length} of ${rows.length} companies`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  <Download className="mr-1.5 size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCsv(exportRows(), "companies")}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel(exportRows(), "companies")}>
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPdf(exportRows(), "companies", "Companies")}>
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canBulkImport && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-1.5 size-4" /> Bulk import
              </Button>
            )}
            {canCreate && (
              <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Add company
              </Button>
            )}
          </>
        }
      />

      <div className="glass flex flex-col gap-3 rounded-2xl p-4 shadow-soft sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, industry or location…"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COMPANY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              to="/companies/$companyId"
              params={{ companyId: r.id }}
              className="glass rounded-2xl p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.industry ?? "Industry not set"}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                </div>
                <Badge className={cn("shrink-0 border-0", STATUS_TONE[r.status])}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </div>
              {r.company_type && (
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                  {r.company_type}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description="Adjust your filters or add a new recruiter to the pipeline."
          action={
            canCreate ? (
              <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Add company
              </Button>
            ) : null
          }
        />
      )}

      <CompanyDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="Companies"
        table="companies"
        dedupeKey="name"
        existingValues={new Set(rows.map((r) => r.name.trim().toLowerCase()))}
        fields={[
          { key: "name", required: true },
          { key: "industry" },
          { key: "location" },
          { key: "website" },
          { key: "linkedin" },
          { key: "company_type" },
          { key: "company_size" },
          { key: "status" },
          { key: "description" },
          { key: "assign_to_email" },
        ]}
        sampleRow={{
          name: "Acme Corp",
          industry: "Information Technology",
          location: "Bengaluru",
          website: "https://acme.com",
          linkedin: "https://linkedin.com/company/acme",
          company_type: "Product",
          company_size: "201-500",
          status: "new",
          description: "Enterprise SaaS recruiter",
          assign_to_email: "coordinator@apollouniversity.edu.in",
        }}
        buildPayload={(row) => ({
          name: row.name?.trim(),
          industry: row.industry?.trim() || null,
          location: row.location?.trim() || null,
          website: row.website?.trim() || null,
          linkedin: row.linkedin?.trim() || null,
          company_type: row.company_type?.trim() || null,
          company_size: row.company_size?.trim() || null,
          status:
            COMPANY_STATUSES.includes(row.status?.trim() as CompanyStatus)
              ? row.status.trim()
              : "new",
          description: row.description?.trim() || null,
        })}
        afterRowInsert={async (insertedRow, rawRow) => {
          const email = rawRow.assign_to_email?.trim().toLowerCase();
          if (!email) return;
          const { data: people } = await db.rpc("list_member_directory", { search: email });
          const person = ((people as { id: string; email: string; role: string | null }[]) ?? []).find(
            (p) => p.email.toLowerCase() === email && p.role === "coordinator",
          );
          if (!person) return; // silently skip — not found, or not a coordinator
          await db.from("company_assignments").insert({
            company_id: (insertedRow as { id: string }).id,
            user_id: person.id,
            assigned_by: user?.id ?? null,
          });
          await createCompanyAssignmentTask({
            companyId: (insertedRow as { id: string }).id,
            companyName: (insertedRow as { name: string }).name,
            assignedTo: person.id,
            assignedBy: user?.id,
          });
        }}
        onImported={load}
      />
    </>
  );
}
