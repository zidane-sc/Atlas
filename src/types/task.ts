export type TaskStatus =
  | "inbox"
  | "todo"
  | "ready"
  | "in_progress"
  | "blocked"
  | "waiting_external"
  | "testing"
  | "done";

export type TaskType =
  | "coding"
  | "investigation"
  | "study"
  | "analysis"
  | "documentation"
  | "bug"
  | "deployment"
  | "testing"
  | "meeting"
  | "research"
  | "design"
  | "maintenance"
  | "refactor"
  | "incident"
  | "communication";

export type Priority = "p0" | "p1" | "p2" | "p3" | "p4";

export type Effort = "xs" | "s" | "m" | "l" | "xl" | "xxl";

export type Reporter = "self" | "qa" | "manager" | "pm" | "client" | "lecturer" | "friend" | "other";

export type RelationType =
  | "blocks"
  | "related"
  | "duplicate"
  | "caused_by"
  | "generated_from";

export type AttachmentType =
  | "github_pr"
  | "github_issue"
  | "confluence"
  | "figma"
  | "slack"
  | "discord"
  | "google_docs"
  | "google_drive"
  | "meeting_recording"
  | "website"
  | "file_upload"
  | "other";

export type DeliverableType =
  | "pr"
  | "confluence"
  | "presentation"
  | "meeting_notes"
  | "design"
  | "video"
  | "pdf"
  | "research";

export interface TaskRelation {
  relationType: RelationType;
  taskId: string;
  title: string;
}

export interface TaskAttachment {
  type: AttachmentType;
  label: string;
  url: string;
}

export interface TaskDeliverable {
  type: DeliverableType;
  label: string;
  url?: string;
}

export interface TaskStatusLogEntry {
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  project: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  effort?: Effort;
  storyPoint?: number;
  dueDate?: string;
  waitingOn?: string;
  sprint?: string;
  reporter?: Reporter;
  /** Accumulated Focus Timer time on this task, in seconds. */
  timeSpentSeconds?: number;
  pinned: boolean;
  tags: string[];
  relations: TaskRelation[];
  attachments: TaskAttachment[];
  deliverables: TaskDeliverable[];
  statusHistory: TaskStatusLogEntry[];
  comments?: TaskComment[];
  completedAt?: string;
}

export interface TaskComment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ActivityLogClient {
  id: string;
  action: string;
  createdAt: string;
  actorName: string;
  taskTitle?: string;
  projectEmoji?: string;
  projectName?: string;
  sprintName?: string;
  details?: any;
}
