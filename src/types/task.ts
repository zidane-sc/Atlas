export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "archived";

export type TaskType =
  | "coding"
  | "research"
  | "design"
  | "documentation"
  | "bug"
  | "meeting"
  | "admin";

export type Priority = "high" | "medium" | "low";

export type TaskSize = "xs" | "s" | "m" | "l" | "xl";

export type Reporter = "self" | "other";

export type RelationType =
  | "blocks"
  | "relates_to"
  | "duplicates";

export type AttachmentType =
  | "github_pr"
  | "github_issue"
  | "link"
  | "file"
  | "other";

export type DeliverableType =
  | "pr"
  | "doc"
  | "design"
  | "other";

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
  urlOrContent?: string;
}

export interface TaskStatusLogEntry {
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  changedAt: string;
}

export interface Task {
  id: string;
  code?: string;
  title: string;
  description?: string;
  project: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  size?: TaskSize;
  startDate?: string;
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
  /**
   * Direct DB column — the real source of truth for "when was this created," replacing the
   * `statusHistory[0]?.changedAt` proxy `createdAt()` (gamification.ts) used to rely on
   * exclusively. Lets bulk task fetches drop the nested `statusHistory` include entirely
   * (docs/05-backlog.md §8 finding #16).
   */
  createdAt: string;
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
