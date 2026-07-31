"use client";

interface DeleteConfirmModalProps {
  noteTitle: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmModal({ noteTitle, isOpen, onConfirm, onCancel, isLoading = false }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onCancel}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      />
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-6 border-2 rounded-lg z-50 shadow-lg"
        style={{ backgroundColor: "var(--color-bg-panel)", borderColor: "var(--color-primary-gold)", minWidth: "320px" }}
      >
        <div className="mb-4">
          <div className="text-lg font-display mb-3" style={{ color: "var(--color-primary-gold)" }}>
            ⚠️ DELETE NOTE
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            Are you sure you want to delete this note?
          </div>
          <div className="text-sm px-3 py-2 rounded bg-red-500/10 border border-red-500/50" style={{ color: "var(--color-foreground)" }}>
            "{noteTitle}"
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            This action cannot be undone.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-3 py-2 border-2 rounded text-sm font-display transition-all"
            style={{
              borderColor: "#ef4444",
              color: "#ef4444",
              backgroundColor: "var(--color-bg-panel)",
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-3 py-2 border-2 rounded text-sm font-display transition-all hover:border-primary-gold"
            style={{
              borderColor: "var(--color-primary-gold)",
              color: "var(--color-foreground)",
              backgroundColor: "var(--color-bg-panel)",
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
