"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/providers/SettingsProvider";

export function DefaultViewRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { settings } = useSettings();

  useEffect(() => {
    if (!session?.user) return;

    if (pathname !== "/dashboard" && pathname !== "/") return;

    const defaultViewSetting = settings.find((s) => s.key === "defaultView");
    const defaultView = (defaultViewSetting?.value as string) || "dashboard";

    if (defaultView !== "dashboard" && pathname === "/dashboard") {
      router.push(`/tasks/${defaultView}`);
    }
  }, [session, pathname, settings, router]);

  return null;
}
