import type { AppRole } from "./auth";

export const COMPANY_STATUSES = [
  "new",
  "contacted",
  "interested",
  "in_discussion",
  "campus_drive",
  "hired",
  "rejected",
  "on_hold",
] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  in_discussion: "In Discussion",
  campus_drive: "Campus Drive",
  hired: "Hired",
  rejected: "Rejected",
  on_hold: "On Hold",
};

export const STATUS_TONE: Record<CompanyStatus, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-info/15 text-info",
  interested: "bg-success/15 text-success",
  in_discussion: "bg-primary/15 text-primary",
  campus_drive: "bg-chart-5/15 text-chart-5",
  hired: "bg-success/20 text-success",
  rejected: "bg-destructive/15 text-destructive",
  on_hold: "bg-warning/20 text-warning",
};

export const MODES = ["call", "email", "meeting", "whatsapp", "video_call"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_LABEL: Record<Mode, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  whatsapp: "WhatsApp",
  video_call: "Video Call",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/20 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

export const FOLLOWUP_STATUSES = ["pending", "completed", "cancelled"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const ROLES: AppRole[] = ["super_admin", "admin", "coordinator", "faculty", "viewer"];

export const INDUSTRIES = [
  "Information Technology",
  "Software Product",
  "Consulting",
  "Finance & Banking",
  "Manufacturing",
  "Core Engineering",
  "Analytics & Data",
  "E-Commerce",
  "Healthcare",
  "Education",
  "Telecom",
  "Other",
];

export const COMPANY_SIZES = ["1-50", "51-200", "201-1000", "1001-5000", "5000+"];
export const COMPANY_TYPES = ["Product", "Service", "Startup", "MNC", "Government", "PSU", "NGO"];

export const RECRUITER_TYPES = [
  "company",
  "hospital",
  "healthcare_organization",
  "research_institute",
  "pharmaceutical_company",
] as const;
export type RecruiterType = (typeof RECRUITER_TYPES)[number];

export const RECRUITER_TYPE_LABEL: Record<RecruiterType, string> = {
  company: "Company",
  hospital: "Hospital",
  healthcare_organization: "Healthcare Organization",
  research_institute: "Research Institute",
  pharmaceutical_company: "Pharmaceutical Company",
};

/** The university's schools/institutes a recruiter can be mapped to. */
export const SCHOOLS = [
  "School of Health Sciences",
  "School of Technology",
  "School of Management",
  "Apollo Institute of Pharmaceutical Sciences",
];

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "waiting",
  "completed",
  "rejected",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  rejected: "Rejected",
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  waiting: "bg-warning/20 text-warning",
  completed: "bg-success/20 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/20 text-warning",
  critical: "bg-destructive/15 text-destructive",
};

export const DEPARTMENTS = [
  "Training & Placement",
  "CSE",
  "IT",
  "ECE",
  "EEE",
  "Mechanical",
  "Civil",
  "MBA",
  "Other",
];
