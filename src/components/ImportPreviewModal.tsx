"use client";

import { Button } from "@/components/ui/button";
import type { ValidationError } from "@/lib/types/import-types";

export interface ImportPreviewModalProps {
  isOpen: boolean;
  counts?: {
    tasks: number;
    projects: number;
    sprints: number;
    notes: number;
    workSessions: number;
    activityLogs: number;
  };
  errors?: ValidationError[];
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportPreviewModal({
  isOpen,
  counts = { tasks: 0, projects: 0, sprints: 0, notes: 0, workSessions: 0, activityLogs: 0 },
  errors = [],
  isLoading = false,
  onCancel,
  onConfirm,
}: ImportPreviewModalProps) {
  if (!isOpen) return null;

  const hasErrors = errors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-card border border-border shadow-lg">
        {/* Header */}
        <div className="sticky top-0 border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Review Import</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Counts Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Import Summary</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Tasks</span>
                <span className="text-foreground font-medium">{counts.tasks}</span>
              </div>
              <div className="flex justify-between">
                <span>Projects</span>
                <span className="text-foreground font-medium">{counts.projects}</span>
              </div>
              <div className="flex justify-between">
                <span>Sprints</span>
                <span className="text-foreground font-medium">{counts.sprints}</span>
              </div>
              <div className="flex justify-between">
                <span>Notes</span>
                <span className="text-foreground font-medium">{counts.notes}</span>
              </div>
              <div className="flex justify-between">
                <span>Work Sessions</span>
                <span className="text-foreground font-medium">{counts.workSessions}</span>
              </div>
              <div className="flex justify-between">
                <span>Activity Logs</span>
                <span className="text-foreground font-medium">{counts.activityLogs}</span>
              </div>
            </div>
          </div>

          {/* Validation Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Validation</h3>
            {hasErrors ? (
              <div className="space-y-2 text-sm bg-red-500/10 border border-red-500/50 rounded p-3">
                {errors.map((error, idx) => (
                  <div key={idx} className="text-red-600 dark:text-red-400">
                    <span className="font-medium">
                      [{error.category} {error.index}]
                    </span>
                    {error.itemName && <span className="ml-1">"{error.itemName}":</span>}
                    <span className="ml-1">{error.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <span>✓ No validation issues</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-border bg-card px-6 py-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={hasErrors || isLoading}
            className={hasErrors ? "opacity-50 cursor-not-allowed" : ""}
          >
            {isLoading ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
