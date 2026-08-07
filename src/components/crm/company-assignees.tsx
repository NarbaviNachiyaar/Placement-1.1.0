import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/data/client";
import { useAuth, usePermissions } from "@/lib/auth";
import { notify } from "@/lib/activity";
import { createCompanyAssignmentTask } from "@/lib/company-tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = { id: string; full_name: string | null; email: string };

/** Assign one or many coordinators to a company. Admins/Super Admins only. */
export function CompanyAssignees({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const { user } = useAuth();
  const { canAssign } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [pick, setPick] = useState("");

  async function load() {
    const [{ data: p }, { data: a }] = await Promise.all([
      db.from("profiles").select("id,full_name,email").order("full_name", { ascending: true }),
      db.from("company_assignments").select("*").eq("company_id", companyId),
    ]);
    setMembers((p as unknown as Member[]) ?? []);
    setAssigned(((a as unknown as { user_id: string }[]) ?? []).map((r) => r.user_id));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m?.full_name || m?.email || "Unknown";
  };

  async function add() {
    if (!pick || assigned.includes(pick)) return;
    const { error } = await db.from("company_assignments").insert({
      company_id: companyId,
      user_id: pick,
      assigned_by: user?.id ?? null,
      created_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    await createCompanyAssignmentTask({
      companyId,
      companyName,
      assignedTo: pick,
      assignedBy: user?.id,
    });
    await notify({
      userId: pick,
      title: "Company assigned to you",
      type: "company",
      link: "/companies",
    });
    setPick("");
    toast.success("Coordinator assigned");
    void load();
  }

  async function remove(userId: string) {
    await db.from("company_assignments").delete().eq("company_id", companyId).eq("user_id", userId);
    toast.success("Assignment removed");
    void load();
  }

  return (
    <div className="glass space-y-3 rounded-2xl p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <UserCheck className="size-4 text-primary" /> Assigned coordinators
      </p>
      <div className="flex flex-wrap gap-2">
        {assigned.length ? (
          assigned.map((id) => (
            <Badge key={id} variant="secondary" className="gap-2">
              {name(id)}
              {canAssign && (
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void remove(id)}
                >
                  ×
                </button>
              )}
            </Badge>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No coordinator assigned yet.</p>
        )}
      </div>
      {canAssign && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-10 rounded-xl sm:w-64">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((m) => !assigned.includes(m.id))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button className="rounded-xl" disabled={!pick} onClick={() => void add()}>
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}
