"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { AchievementDisplay } from "@/lib/achievements-data";

const AchievementsContent = dynamic(
  () => import("./AchievementsContent"),
  {
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted-foreground/20 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted-foreground/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function AchievementsPage({ achievements }: { achievements: AchievementDisplay[] }) {
  return (
    <Suspense fallback={<div className="p-8">Loading achievements...</div>}>
      <AchievementsContent achievements={achievements} />
    </Suspense>
  );
}
