"use client";

import type { NotePreview } from "@/types/note";

interface NoteListProps {
  notes: NotePreview[];
  onSelectNote: (note: NotePreview) => void;
  onDeleteNote: (id: string) => void;
}

export function NoteList({ notes, onSelectNote, onDeleteNote }: NoteListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {notes.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-lg mb-2" style={{ color: "var(--color-primary-gold)" }}>📭</div>
          <div className="text-sm text-muted-foreground">No notes yet. Create one to get started.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 cursor-pointer transition-all border-2 rounded hover:border-primary-gold group"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
              onClick={() => onSelectNote(note)}
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <h3 className="font-display text-sm text-foreground flex-1" style={{ color: "var(--color-foreground)" }}>
                  {note.title}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className="px-2 py-1 rounded text-xs transition-all opacity-0 group-hover:opacity-100 border"
                  style={{ borderColor: "#ef4444", color: "#ef4444" }}
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{note.preview}</p>
              <div className="flex gap-2 items-center text-xs flex-wrap">
                {note.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                    {tag}
                  </span>
                ))}
                {note.linkedTaskCount > 0 && (
                  <span className="px-2 py-1 rounded" style={{ backgroundColor: "var(--color-primary-gold)/10", color: "var(--color-primary-gold)" }}>
                    🔗 {note.linkedTaskCount}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
