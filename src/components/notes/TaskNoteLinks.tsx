"use client";

import { useState, useEffect } from "react";
import { getTaskNotesAction } from "@/lib/actions/notes";
import type { NotePreview } from "@/types/note";

interface TaskNoteLinksProps {
  taskId: string;
  onAddNote?: () => void;
}

export function TaskNoteLinks({ taskId, onAddNote }: TaskNoteLinksProps) {
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadNotes();
    }
  }, [open]);

  const loadNotes = async () => {
    setLoading(true);
    const result = await getTaskNotesAction(taskId);
    if (result.success) {
      setNotes(result.data!.notes);
    }
    setLoading(false);
  };

  if (notes.length === 0 && !open) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>Linked Notes ({notes.length})</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-muted-foreground">No linked notes yet.</div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-2 bg-secondary rounded text-xs">
                <div className="font-semibold">{note.title}</div>
                <div className="text-muted-foreground">{note.preview}</div>
              </div>
            ))
          )}
          {onAddNote && (
            <button onClick={onAddNote} className="text-xs text-primary hover:underline">
              + Link a note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
