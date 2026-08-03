// Real Supabase-backed data adapter.
//
// `db` is the same shared Supabase client used everywhere else in the app
// (from `@/lib/supabase` — no second client is created). It's re-exported
// here under the name `db` so every screen that already calls
// `db.from("table").select()...` keeps working unchanged: Supabase's
// query builder is API-compatible with what this file used to fake locally.

import { supabase } from "@/lib/supabase";
import type { TableName } from "./types";

export const db = supabase;

/** Client-side id generation is no longer needed — Postgres generates
 *  UUIDs via `gen_random_uuid()` on insert. Kept as a no-op export only in
 *  case anything still imports it. */
export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** No-op: there is no local cache to reset anymore — data lives in Supabase. */
export function resetLocalData() {
  /* intentionally empty */
}

export type { Row, TableName } from "./types";
