// Domain types for the local (frontend-only) data layer.
// These mirror what a future backend (Firebase / Appwrite / custom API) would return,
// so swapping the adapter in `src/lib/data/client.ts` requires no UI changes.

export type AppRole = "super_admin" | "admin" | "coordinator" | "faculty" | "viewer";

export type TaskStatus = "pending" | "in_progress" | "waiting" | "completed" | "rejected";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export type Row = Record<string, unknown> & { id: string };

export type TableName =
  | "profiles"
  | "user_roles"
  | "approved_users"
  | "companies"
  | "company_assignments"
  | "contacts"
  | "followups"
  | "notes"
  | "tasks"
  | "task_notes"
  | "task_attachments"
  | "activity_logs"
  | "notifications";

export type Database = Record<TableName, Row[]>;
