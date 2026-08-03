export type AchievementCategory = "combat" | "exploration" | "crafting" | "social";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xp: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  code?: string;
  colorVar: string;
  customColor?: string;
  emoji: string;
  category: string;
  description: string;
  status: "active" | "on_hold" | "completed";
}

export interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: "planning" | "active" | "completed";
  goal: string;
}
