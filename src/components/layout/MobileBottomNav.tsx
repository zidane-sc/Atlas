"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sun, CheckSquare, Home, Menu } from "lucide-react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { MOCK_NOW } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { tasks } = useTasks();
  const { setMobileOpen } = useSidebar();

  const todayCount = tasks.filter(
    (t) => t.status !== "done" && (t.dueDate === MOCK_NOW || t.status === "in_progress")
  ).length;

  const directTabs = [
    { href: "/dashboard", label: "Command", icon: LayoutDashboard },
    { href: "/tasks/today", label: "Today", icon: Sun, badge: todayCount },
    { href: "/tasks", label: "Quests", icon: CheckSquare },
    { href: "/room", label: "Room", icon: Home },
  ];

  const isMenuRoute = !directTabs.some((tab) => tab.href === pathname);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 flex h-14 items-center justify-around border-t-2 border-border lg:hidden pb-safe select-none"
      style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {directTabs.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center py-1 transition-colors relative cursor-pointer",
              active ? "text-[var(--color-primary-gold)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Icon size={17} />
              {badge !== undefined && badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-3.5 min-w-[14px] items-center justify-center px-0.5 text-[9px] font-bold font-mono"
                  style={{
                    backgroundColor: "var(--color-primary-gold)",
                    color: "#000",
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                "mt-0.5 text-[10px] font-mono tracking-tight",
                active && "font-bold"
              )}
            >
              {label}
            </span>
            {active && (
              <span
                className="absolute top-0 inset-x-3 h-[2px]"
                style={{ backgroundColor: "var(--color-primary-gold)" }}
              />
            )}
          </Link>
        );
      })}

      {/* 5th Tab: Menu (opens full sidebar drawer) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={cn(
          "flex flex-1 flex-col items-center justify-center py-1 transition-colors relative cursor-pointer",
          isMenuRoute ? "text-[var(--color-primary-gold)]" : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Open full menu"
      >
        <div className="relative flex items-center justify-center">
          <Menu size={17} />
        </div>
        <span
          className={cn(
            "mt-0.5 text-[10px] font-mono tracking-tight",
            isMenuRoute && "font-bold"
          )}
        >
          Menu
        </span>
        {isMenuRoute && (
          <span
            className="absolute top-0 inset-x-3 h-[2px]"
            style={{ backgroundColor: "var(--color-primary-gold)" }}
          />
        )}
      </button>
    </nav>
  );
}
