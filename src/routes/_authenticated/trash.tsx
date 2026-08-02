import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/crm/ui-kit";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({
    meta: [
      { title: "Trash — Placement CRM" },
      { name: "description", content: "Restore or permanently delete archived companies." },
      { property: "og:title", content: "Trash — Placement CRM" },
      {
        property: "og:description",
        content: "Restore or permanently delete archived companies.",
      },
    ],
  }),
  component: TrashPage,
});

type Row = { id: string; name: string; deleted_at: string };

function TrashPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await db
      .from("companies")
      .select("id,name,deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function restore(row: Row) {
    const { error } = await db
      .from("companies")
      .update({ deleted_at: null })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Company Restored",
      entityType: "company",
      companyId: row.id,
      details: row.name,
    });
    toast.success(`${row.name} restored`);
    void load();
  }

  async function purge(row: Row) {
    const { error } = await db.from("companies").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logActivity({
      userId: user?.id,
      userEmail: user?.email,
      action: "Company Permanently Deleted",
      entityType: "company",
      details: row.name,
    });
    toast.success("Permanently deleted");
    void load();
  }

  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon={Trash2}
        title="Restricted"
        description="Only a Super Admin can access the trash."
      />
    );
  }

  return (
    <>
      <PageHeader title="Trash" description="Deleted companies stay here until purged." />
      {loading ? (
        <ListSkeleton />
      ) : rows.length ? (
        <ul className="glass divide-y rounded-2xl p-2 shadow-soft">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  Deleted {new Date(r.deleted_at).toLocaleString()}
                </p>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void restore(r)}>
                <RotateCcw className="mr-1.5 size-4" /> Restore
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {r.name} permanently?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the company and all related contacts, follow-ups and notes. This
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void purge(r)}>Delete forever</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Trash2} title="Trash is empty" description="Nothing has been deleted." />
      )}
    </>
  );
}
