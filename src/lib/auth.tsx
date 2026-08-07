import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { auth, type LocalSession, type LocalUser } from "@/lib/data/auth";
import type { AppRole } from "@/lib/data/types";

export type { AppRole };

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login: string | null;
  alternate_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  date_of_birth: string | null;
  gender: string | null;
  emergency_contact: string | null;
  blood_group: string | null;
  joining_date: string | null;
  designation: string | null;
  student_id: string | null;
  roll_number: string | null;
  course: string | null;
  academic_year: string | null;
  semester: string | null;
  section: string | null;
  batch: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  hostel_or_day_scholar: string | null;
  faculty_mentor: string | null;
};

type AuthContextValue = {
  session: LocalSession | null;
  user: LocalUser | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  coordinator: "Placement Coordinator",
  faculty: "Faculty",
  viewer: "Viewer",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setRole(null);
      return;
    }
    let [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle(),
    ]);

    // Self-heal: this happens whenever the DB-trigger-based auto-provision
    // never ran for this account — most commonly because the auth account
    // already existed before profiles/user_roles were (re)created, so the
    // "new user" trigger never fired for them. Rather than leaving the
    // person stuck with a blank profile and no role, create what's missing
    // right here, looking up their intended role from approved_users.
    if (!p || !r) {
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser.user?.email ?? "";

      if (!p) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert(
            { id: userId, email, full_name: email.split("@")[0], last_login: new Date().toISOString() },
            { onConflict: "id" },
          )
          .select("*")
          .maybeSingle();
        p = created;
      }

      if (!r) {
        const { data: approved } = await supabase
          .from("approved_users")
          .select("role")
          .eq("email", email.toLowerCase())
          .maybeSingle();
        const roleToAssign = approved?.role ?? "viewer";
        const { data: createdRole } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role: roleToAssign }, { onConflict: "user_id,role" })
          .select("role")
          .maybeSingle();
        r = createdRole;
      }
    }

    setProfile((p as unknown as Profile) ?? null);
    setRole(((r?.role as AppRole) ?? null) as AppRole | null);

    // Revoked accounts must not keep using the app just because their
    // browser session hasn't expired yet.
    if (p && (p as unknown as Profile).is_active === false) {
      await auth.signOut();
      setSession(null);
      setProfile(null);
      setRole(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    const sub = auth.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      void load(s?.user?.id);
    });

    void auth.getSession().then(async (current) => {
      if (!mounted) return;
      setSession(current);
      await load(current?.user?.id);
      if (mounted) setLoading(false);
    });

    // Re-verify access every couple of minutes for sessions that were
    // already open when an admin revoked them — otherwise a revoked
    // person could stay logged in until their token happens to expire.
    const interval = setInterval(() => {
      void supabase.auth.getUser().then(({ data }) => {
        if (mounted && data.user) void load(data.user.id);
      });
    }, 120_000);

    return () => {
      mounted = false;
      sub.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role,
      loading,
      refresh: () => load(session?.user?.id),
      signOut: async () => {
        await auth.signOut();
        setProfile(null);
        setRole(null);
      },
    }),
    [session, profile, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function usePermissions() {
  const { role } = useAuth();

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isManager = isSuperAdmin || isAdmin; // super_admin + admin
  const isFaculty = role === "faculty";
  const isCoordinator = role === "coordinator";
  const isViewer = role === "viewer";

  // "Elevated staff" = everyone who can create/manage placement work
  // (super_admin, admin, faculty) as opposed to coordinators, who only
  // manage their own assigned slice, and viewers, who are read-only.
  const isElevatedStaff = isManager || isFaculty;

  return {
    role,
    isSuperAdmin,
    isAdmin,
    isManager,
    isFaculty,
    isCoordinator,
    isViewer,

    // ── Companies ──────────────────────────────────────────────────────────
    canCreateCompanies: isElevatedStaff,
    canEditCompanies: isElevatedStaff,
    canDeleteCompanies: isManager, // super_admin + admin only, not faculty
    canViewAllCompanies: true, // everyone can at least read every company
    canAssignCompanies: isManager,
    canBulkImport: isManager, // only super_admin + admin, per explicit request

    // ── Follow-ups ─────────────────────────────────────────────────────────
    canCreateFollowups: isElevatedStaff || isCoordinator, // coordinators: assigned companies only, enforced per-row
    canManageAnyFollowup: isElevatedStaff, // edit/delete anyone's
    canManageOwnFollowupOnly: isCoordinator, // edit/delete only their own

    // ── Tasks ──────────────────────────────────────────────────────────────
    canCreateTasks: isElevatedStaff,
    canAssignTasks: isManager || isFaculty, // faculty can assign to coordinators
    canReviewTasks: isManager || isFaculty,
    canUpdateOwnTaskStatus: true, // everyone (incl. coordinators) can update tasks assigned to them

    // ── Notes / uploads / voice ──────────────────────────────────────────────
    canAddNotes: !isViewer,
    canUploadDocuments: !isViewer,
    canUseVoiceToText: !isViewer,

    // ── Team / users ───────────────────────────────────────────────────────
    canInvite: isManager, // super_admin + admin can invite
    canRemoveUsers: isSuperAdmin, // ONLY super admin deletes/deactivates users
    canChangeRoles: isSuperAdmin, // ONLY super admin promotes/demotes
    canRevokePermissions: isSuperAdmin,
    canTransferOwnership: isSuperAdmin,
    canEditOthersWork: isSuperAdmin, // overwrite/edit another user's records directly

    // ── Reports / logs / admin ────────────────────────────────────────────
    canViewReports: isElevatedStaff,
    canViewActivityLogs: isSuperAdmin,
    canViewAuditLogs: isSuperAdmin,
    canExportActivityLogs: isSuperAdmin,
    canViewLoginHistory: isSuperAdmin,
    canViewDbStats: isSuperAdmin,
    canAccessDbAdmin: isSuperAdmin,
    canManageDepartments: isSuperAdmin,
    canManageSettings: isSuperAdmin,

    // ── Legacy aliases kept for existing call sites (unchanged behavior) ──
    canCreate: isElevatedStaff || isCoordinator,
    canDelete: isSuperAdmin,
    canAssign: isManager,
    readOnly: isViewer,
  };
}
