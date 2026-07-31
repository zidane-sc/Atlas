"use client";

import type { NotePreview } from "@/types/note";

interface NoteListProps {
  notes: NotePreview[];
  onSelectNote: (note: NotePreview) => void;
  onDeleteNote: (id: string) => void;
}

export function NoteList({ notes, onSelectNote, onDeleteNote }: NoteListProps) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {notes.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-lg mb-2" style={{ color: "var(--color-primary-gold)" }}>📭</div>
          <div className="text-sm text-muted-foreground">No notes yet. Create one to get started.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 cursor-pointer transition-all border-2 rounded hover:border-primary-gold group h-full flex flex-col"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
              onClick={() => onSelectNote(note)}
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-display text-sm text-foreground flex-1 line-clamp-2" style={{ color: "var(--color-foreground)" }}>
                  {note.title}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className="px-2 py-1 rounded text-xs transition-all opacity-0 group-hover:opacity-100 border flex-shrink-0"
                  style={{ borderColor: "#ef4444", color: "#ef4444" }}
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{note.preview}</p>
              <div className="flex gap-1 items-center text-xs flex-wrap mb-3">
                {note.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                    {tag}
                  </span>
                ))}
                {note.tags.length > 2 && (
                  <span className="text-muted-foreground text-xs">+{note.tags.length - 2}</span>
                )}
                {note.linkedTaskCount > 0 && (
                  <span className="px-2 py-1 rounded" style={{ backgroundColor: "var(--color-primary-gold)/10", color: "var(--color-primary-gold)" }}>
                    🔗 {note.linkedTaskCount}
                  </span>
                )}
              </div>
              <div className="border-t border-gray-600 pt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
                <div>📅 {formatDate(note.createdAt)}</div>
                <div>✏️ {formatDate(note.updatedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
