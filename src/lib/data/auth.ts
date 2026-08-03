// Real Supabase auth adapter.
//
// Wraps supabase.auth so the rest of the app (AuthProvider, login page,
// password setup) talks to Supabase Authentication instead of a mock/local
// store. Uses the single shared client from `@/lib/supabase` — no separate
// client is created here.

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type LocalUser = { id: string; email: string };
export type LocalSession = { user: LocalUser; created_at: string };

type Listener = (session: LocalSession | null) => void;

function toLocalSession(
  session: { user: { id: string; email?: string | null; created_at?: string } } | null,
): LocalSession | null {
  if (!session?.user?.email) return null;
  return {
    user: { id: session.user.id, email: session.user.email },
    created_at: session.user.created_at ?? new Date().toISOString(),
  };
}

export const auth = {
  /** Current session, if any. Async — Supabase reads it from storage/cookies. */
  async getSession(): Promise<LocalSession | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return toLocalSession(data.session);
  },

  /** Subscribes to sign-in / sign-out / token-refresh events. */
  onAuthStateChange(cb: Listener) {
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      cb(toLocalSession(session));
    });
    return {
      unsubscribe() {
        data.subscription.unsubscribe();
      },
    };
  },

  /** Checks the allow-list before we let someone attempt to sign in. */
  async isApproved(email: string) {
    const { data, error } = await supabase
      .from("approved_users")
      .select("is_active")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.is_active);
  },

  /** Password sign-in via Supabase Auth. */
  async signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null as string | null };
  },

  /** Sends a real one-time-passcode / magic-link email through Supabase. */
  async sendOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) return { error: error.message };
    return { error: null as string | null };
  },

  /** Verifies the 6-digit email code the user typed in. */
  async verifyOtp(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) return { session: null, error: error.message };
    return { session: toLocalSession(data.session), error: null as string | null };
  },

  /** Sets/changes the password for the currently signed-in user. */
  async setPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { error: null as string | null };
  },

  /** Sends a real "reset your password" email through Supabase. */
  async resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) return { error: error.message };
    return { error: null as string | null };
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};
