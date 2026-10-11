"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { AchievementDisplay } from "@/lib/achievements-data";
import { PixelLoading } from "@/components/ui/PixelLoading";

const AchievementsContent = dynamic(
  () => import("./AchievementsContent"),
  {
    loading: () => <PixelLoading text="LOADING ACHIEVEMENTS..." />,
    ssr: false,
  }
);

export function AchievementsPage({ achievements }: { achievements: AchievementDisplay[] }) {
  return (
    <Suspense fallback={<PixelLoading text="LOADING ACHIEVEMENTS..." />}>
      <AchievementsContent achievements={achievements} />
    </Suspense>
  );
}
