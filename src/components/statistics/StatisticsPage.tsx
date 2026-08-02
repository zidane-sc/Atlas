"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { StatisticsData } from "@/lib/statistics-data";

const StatisticsContent = dynamic(
  () => import("./StatisticsContent"),
  {
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted-foreground/20 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-muted-foreground/20 rounded" />
            <div className="h-64 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function StatisticsPage({ stats }: { stats: StatisticsData }) {
  return (
    <Suspense fallback={<div className="p-8">Loading statistics...</div>}>
      <StatisticsContent stats={stats} />
    </Suspense>
  );
}
