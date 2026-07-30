"use client";

import { useState } from "react";
import { RecapCutscene, type RecapData } from "./RecapCutscene";

export function RecapTrigger({
  weekly,
  monthly,
}: {
  weekly: RecapData;
  monthly: RecapData;
}) {
  const [open, setOpen] = useState<"week" | "month" | null>(null);

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen("week")}
          className="pixel-button border-2 border-border bg-secondary px-2 py-0.5 text-sm text-foreground"
        >
          📜 Weekly Recap
        </button>
        <button
          onClick={() => setOpen("month")}
          className="pixel-button border-2 border-border bg-secondary px-2 py-0.5 text-sm text-foreground"
        >
          📜 Monthly Recap
        </button>
      </div>
      {open && (
        <RecapCutscene data={open === "week" ? weekly : monthly} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
