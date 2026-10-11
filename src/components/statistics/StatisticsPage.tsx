"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { StatisticsData } from "@/lib/statistics-data";
import { PixelLoading } from "@/components/ui/PixelLoading";

const StatisticsContent = dynamic(
  () => import("./StatisticsContent"),
  {
    loading: () => <PixelLoading text="LOADING PROGRESS..." />,
    ssr: false,
  }
);

export function StatisticsPage({ stats }: { stats: StatisticsData }) {
  return (
    <Suspense fallback={<PixelLoading text="LOADING PROGRESS..." />}>
      <StatisticsContent stats={stats} />
    </Suspense>
  );
}
