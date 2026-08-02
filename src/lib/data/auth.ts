// Local, frontend-only auth adapter.
//
// No auth provider is wired in. Sessions and (mock) passwords live in
// localStorage. Swapping this module for Clerk / Auth.js / Firebase Auth later
// only requires keeping the same exported surface.

import { db } from "./client";
import type { AppRole } from "./types";

const SESSION_KEY = "placement-crm:session:v1";
const PASSWORD_KEY = "placement-crm:passwords:v1";

export type LocalUser = { id: string; email: string };
export type LocalSession = { user: LocalUser; created_at: string };

type Listener = (session: LocalSession | null) => void;
const listeners = new Set<Listener>();

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function emit(session: LocalSession | null) {
  listeners.forEach((l) => l(session));
}

async function findApproved(email: string) {
  const { data } = await db.from("approved_users").select().eq("email", email.toLowerCase()).maybeSingle();
  return data as { id: string; email: string; role: AppRole; is_active: boolean } | null;
}

async function findProfile(email: string) {
  const { data } = await db.from("profiles").select().eq("email", email.toLowerCase()).maybeSingle();
  return data as { id: string; email: string } | null;
}

export const auth = {
  getSession(): LocalSession | null {
    return readJson<LocalSession | null>(SESSION_KEY, null);
  },

  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return {
      unsubscribe() {
        listeners.delete(cb);
      },
    };
  },

  async isApproved(email: string) {
    const approved = await findApproved(email);
    return Boolean(approved?.is_active);
  },

  hasPassword(email: string) {
    const map = readJson<Record<string, string>>(PASSWORD_KEY, {});
    return Boolean(map[email.toLowerCase()]);
  },

  async signInWithPassword(email: string, password: string) {
    const approved = await findApproved(email);
    if (!approved?.is_active) return { error: "This email is not approved for access." };
    const map = readJson<Record<string, string>>(PASSWORD_KEY, {});
    const stored = map[email.toLowerCase()];
    if (!stored) return { error: "No password set yet. Use the one-time code to sign in." };
    if (stored !== password) return { error: "Incorrect password." };
    return this.startSession(email);
  },

  /** First login (or after a reset) — no password required yet. */
  async signInFirstTime(email: string) {
    const approved = await findApproved(email);
    if (!approved?.is_active) return { error: "This email is not approved for access." };
    return this.startSession(email);
  },

  async startSession(email: string) {
    let profile = await findProfile(email);
    if (!profile) {
      const approved = await findApproved(email);
      const { data } = await db.from("profiles").insert({
        email: email.toLowerCase(),
        full_name: email.split("@")[0],
        department: null,
        phone: null,
        avatar_url: null,
        is_active: true,
        last_login: new Date().toISOString(),
      });
      profile = (data as { id: string; email: string }[])[0];
      await db.from("user_roles").insert({ user_id: profile.id, role: approved?.role ?? "viewer" });
    }
    const session: LocalSession = {
      user: { id: profile.id, email: profile.email },
      created_at: new Date().toISOString(),
    };
    writeJson(SESSION_KEY, session);
    await db.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", profile.id);
    emit(session);
    return { session, error: null as string | null };
  },

  setPassword(email: string, password: string) {
    const map = readJson<Record<string, string>>(PASSWORD_KEY, {});
    map[email.toLowerCase()] = password;
    writeJson(PASSWORD_KEY, map);
    return { error: null as string | null };
  },

  clearPassword(email: string) {
    const map = readJson<Record<string, string>>(PASSWORD_KEY, {});
    delete map[email.toLowerCase()];
    writeJson(PASSWORD_KEY, map);
  },

  signOut() {
    if (isBrowser()) window.localStorage.removeItem(SESSION_KEY);
    emit(null);
  },
};
