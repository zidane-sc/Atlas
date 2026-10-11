"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { PixelLoading } from "@/components/ui/PixelLoading";

const CharacterContent = dynamic(
  () => import("./CharacterContent"),
  {
    loading: () => <PixelLoading text="LOADING CHARACTER..." />,
    ssr: false,
  }
);

export function CharacterPage() {
  return (
    <Suspense fallback={<PixelLoading text="LOADING CHARACTER..." />}>
      <CharacterContent />
    </Suspense>
  );
}
