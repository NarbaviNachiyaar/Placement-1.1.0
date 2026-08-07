import { db } from "@/lib/data/client";

/**
 * Whenever a company is assigned to someone, a task should exist for it —
 * so assignment always shows up as real, trackable work, not just a label
 * on the company record.
 */
export async function createCompanyAssignmentTask(params: {
  companyId: string;
  companyName: string;
  assignedTo: string;
  assignedBy: string | null | undefined;
}) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);

  await db.from("tasks").insert({
    title: `Work on ${params.companyName}`,
    description: `Follow up and progress the recruitment process for ${params.companyName}.`,
    assigned_by: params.assignedBy ?? null,
    assigned_to: params.assignedTo,
    priority: "medium",
    status: "pending",
    progress: 0,
    deadline: deadline.toISOString().slice(0, 10),
    company_id: params.companyId,
  });
}
