"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const CharacterContent = dynamic(
  () => import("./CharacterContent"),
  {
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="flex gap-4">
            <div className="h-24 w-24 bg-muted-foreground/20 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 bg-muted-foreground/20 rounded" />
              <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted-foreground/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export function CharacterPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading character sheet...</div>}>
      <CharacterContent />
    </Suspense>
  );
}
