import type { ComponentType } from "react";
import {
  AlertCircle,
  BarChart2,
  Clock,
  Crosshair,
  Folder,
  Grid3X3,
  Home,
  Inbox as InboxIcon,
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  Sun,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";

export interface NavItemBase {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

/** Single source of truth for app navigation — Sidebar layers live count badges on top, CommandPalette uses the flat list as-is. */
export const NAV_CORE: NavItemBase[] = [{ href: "/dashboard", label: "Command Center", icon: LayoutDashboard }];

export const NAV_TASKS: NavItemBase = { href: "/tasks", label: "Tasks", icon: Grid3X3 };

export const NAV_SMART_VIEWS: NavItemBase[] = [
  { href: "/tasks/today", label: "Today", icon: Sun },
  { href: "/tasks/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/tasks/overdue", label: "Overdue", icon: AlertCircle },
  { href: "/tasks/waiting", label: "Waiting Ext.", icon: Clock },
  { href: "/tasks/focus", label: "Focus", icon: Crosshair },
];

export const NAV_MANAGE: NavItemBase[] = [
  { href: "/notes", label: "Notes", icon: MessageSquare },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/sprints", label: "Sprints", icon: Zap },
  { href: "/character", label: "Character", icon: Swords },
  { href: "/room", label: "Room", icon: Home },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/statistics", label: "Progress", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export const NAV_ITEMS_FLAT: { href: string; label: string }[] = [
  ...NAV_CORE,
  NAV_TASKS,
  ...NAV_SMART_VIEWS,
  ...NAV_MANAGE,
].map(({ href, label }) => ({ href, label }));
