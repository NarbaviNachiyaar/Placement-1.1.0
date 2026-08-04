import type { AppRole } from "@/lib/data/types";
import type { TaskPriority, TaskStatus } from "@/lib/crm";

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  assigned_by: string | null;
  assigned_to: string | null;
  department: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  deadline: string | null;
  completed_at: string | null;
  company_id: string | null;
  review_status: "none" | "pending" | "approved" | "rejected";
  extension_requested: boolean;
  extension_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskNote = {
  id: string;
  task_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  name: string;
  size: number;
  type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

/**
 * Role + ownership rules for a single task. Kept in one place so a future
 * backend can enforce exactly the same matrix server-side.
 */
export function taskAbilities(
  role: AppRole | null,
  userId: string | undefined,
  task?: TaskRecord | null,
) {
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isFaculty = role === "faculty";
  const isCoordinator = role === "coordinator";
  const isManagerOrFaculty = isSuperAdmin || isAdmin || isFaculty;
  const isOwner = Boolean(task && userId && task.assigned_to === userId);

  return {
    canCreate: isManagerOrFaculty,
    canAssignAnyone: isSuperAdmin || isAdmin,
    canReassign: isSuperAdmin || isAdmin,
    canEdit: isManagerOrFaculty,
    canReview: isManagerOrFaculty,
    canUpdateProgress: isManagerOrFaculty || (isCoordinator && isOwner),
    canAddNotes: isManagerOrFaculty || (isCoordinator && isOwner),
    canUpload: isManagerOrFaculty || (isCoordinator && isOwner),
    canComplete: isManagerOrFaculty || (isCoordinator && isOwner),
    canRequestExtension: isCoordinator && isOwner,
    readOnly: role === "viewer",
  };
}

/** Which tasks a role is allowed to see. */
export function visibleTasks(
  tasks: TaskRecord[],
  role: AppRole | null,
  userId: string | undefined,
) {
  if (role === "super_admin" || role === "admin" || role === "faculty" || role === "viewer")
    return tasks;
  return tasks.filter((t) => t.assigned_to === userId);
}

export function isOverdue(task: TaskRecord) {
  if (!task.deadline || task.status === "completed" || task.status === "rejected") return false;
  return new Date(task.deadline) < new Date(new Date().toDateString());
}
