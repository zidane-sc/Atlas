"use client";

import { useState, useEffect } from "react";
import { listNotesAction, deleteNoteAction } from "@/lib/actions/notes";
import { NoteList } from "@/components/notes/NoteList";
import { NoteEditor } from "@/components/notes/NoteEditor";
import type { NotePreview } from "@/types/note";

export default function NotesPage() {
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [search, selectedTags]);

  const loadNotes = async () => {
    setLoading(true);
    const result = await listNotesAction({
      search: search || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    });
    if (result.success) {
      setNotes(result.data!.notes);
      const tags = new Set<string>();
      result.data!.notes.forEach((note) => note.tags.forEach((tag) => tags.add(tag)));
      setAllTags(Array.from(tags));
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this note?")) {
      await deleteNoteAction(id);
      setNotes(notes.filter((n) => n.id !== id));
    }
  };

  const handleSelectNote = (note: NotePreview) => {
    setEditingNoteId(note.id);
  };

  const handleSaveNote = async () => {
    setEditingNoteId(null);
    setIsCreating(false);
    await loadNotes();
  };

  if (editingNoteId || isCreating) {
    return (
      <NoteEditor
        noteId={editingNoteId || undefined}
        onSave={handleSaveNote}
        onClose={() => {
          setEditingNoteId(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3 border-b border-border bg-panel-alt">
        <h1 className="font-display text-sm tracking-wide" style={{ color: "var(--color-primary-gold)" }}>
          📝 NOTES
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded bg-card text-sm"
          />
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
          >
            New Note
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                  )
                }
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center flex-1">Loading...</div>
        ) : (
          <NoteList notes={notes} onSelectNote={handleSelectNote} onDeleteNote={handleDelete} />
        )}
      </div>
    </div>
  );
}
