"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";

export function DefaultViewRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { defaultView } = useSettings();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (pathname !== "/dashboard") return;

    // Direct landing on /dashboard: redirect once per session if user configured another default view
    if (typeof window !== "undefined") {
      const visited = sessionStorage.getItem("atlas:session_started");
      if (!visited) {
        sessionStorage.setItem("atlas:session_started", "true");
        if (defaultView && defaultView !== "dashboard") {
          redirectedRef.current = true;
          router.replace(defaultView === "kanban" ? "/tasks" : `/tasks/${defaultView}`);
        }
      }
    }
  }, [pathname, defaultView, router]);

  return null;
}
