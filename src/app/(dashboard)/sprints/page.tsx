"use client";

import { AlertCircle } from "lucide-react";

export default function Page() {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="text-center">
        <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
        <h1 className="mb-2 text-xl font-display" style={{ color: "var(--color-primary-gold)" }}>
          SPRINTS REMOVED
        </h1>
        <p className="text-muted-foreground">
          Sprint feature has been removed in the simplified model.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use Projects + due dates for time-boxed work instead.
        </p>
      </div>
    </div>
  );
}
