"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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

  return (
    <Collapsible defaultOpen={false} className="border-2 border-border" onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2.5 text-left text-sm tracking-widest text-muted-foreground hover:bg-[var(--color-bg-panel-alt)]">
        <span className="flex items-center gap-2">
          <span style={{ color: "var(--color-primary-gold)" }}>📝</span>
          <span>Linked Notes ({notes.length})</span>
        </span>
        <ChevronDown size={12} className="transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t-2 border-border px-3 py-3 text-sm space-y-2">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-muted-foreground">No linked notes yet.</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-2 bg-secondary rounded text-xs">
              <div className="font-semibold">{note.title}</div>
              <div className="text-muted-foreground">{note.preview}</div>
              <div className="text-xs mt-1 text-muted-foreground">
                🔗 {note.linkedTaskCount} quest{note.linkedTaskCount !== 1 ? 's' : ''}
              </div>
            </div>
          ))
        )}
        {onAddNote && (
          <button onClick={onAddNote} className="text-xs text-primary hover:underline mt-2">
            + Link a note
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
