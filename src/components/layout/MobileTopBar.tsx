"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/providers/SidebarProvider";

export function MobileTopBar() {
  const { setMobileOpen } = useSidebar();

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 lg:hidden"
      style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="flex items-center justify-center p-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Menu size={18} />
      </button>
      <div style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "12px", color: "var(--color-primary-gold)" }}>
        ⚔ ATLAS
      </div>
    </div>
  );
}
