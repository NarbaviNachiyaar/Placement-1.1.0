import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "@/lib/data/client";
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
    const [{ data: p }, { data: r }] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle(),
    ]);
    setProfile((p as unknown as Profile) ?? null);
    setRole(((r?.role as AppRole) ?? null) as AppRole | null);
  }

  useEffect(() => {
    let mounted = true;
    const sub = auth.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      void load(s?.user?.id);
    });

    const current = auth.getSession();
    setSession(current);
    void load(current?.user?.id).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
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
        auth.signOut();
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
  const isManager = role === "super_admin" || role === "admin";
  const isCoordinator = role === "coordinator";
  const canCreate = isManager || isCoordinator;
  return {
    role,
    isSuperAdmin,
    isManager,
    isCoordinator,
    canCreate,
    canDelete: isSuperAdmin,
    canAssign: isManager,
    canInvite: isManager,
    canCreateTasks: canCreate,
    canReviewTasks: isManager,
    canAddNotes: role !== "viewer" && role !== null,
    readOnly: role === "viewer" || role === "faculty",
  };
}
