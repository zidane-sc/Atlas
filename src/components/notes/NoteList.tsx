"use client";

import type { NotePreview } from "@/types/note";

interface NoteListProps {
  notes: NotePreview[];
  onSelectNote: (note: NotePreview) => void;
  onDeleteNote: (id: string) => void;
}

export function NoteList({ notes, onSelectNote, onDeleteNote }: NoteListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {notes.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">No notes yet. Create one to get started.</div>
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 cursor-pointer hover:bg-accent transition-colors border-b border-border"
              onClick={() => onSelectNote(note)}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <h3 className="font-semibold text-sm text-foreground">{note.title}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{note.preview}</p>
              <div className="flex gap-2 items-center text-xs">
                {note.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded">
                    {tag}
                  </span>
                ))}
                {note.linkedTaskCount > 0 && (
                  <span className="text-muted-foreground">🔗 {note.linkedTaskCount}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
