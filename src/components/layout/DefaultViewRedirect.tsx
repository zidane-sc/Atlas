"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";

export function DefaultViewRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();

  useEffect(() => {
    if (pathname !== "/") return;

    const defaultViewSetting = settings.find((s) => s.key === "defaultView");
    const defaultView = (defaultViewSetting?.value as string) || "dashboard";

    if (defaultView !== "dashboard") {
      // Kanban is the default tab shown at /tasks itself, not its own route.
      router.push(defaultView === "kanban" ? "/tasks" : `/tasks/${defaultView}`);
    }
  }, [pathname, settings, router]);

  return null;
}
