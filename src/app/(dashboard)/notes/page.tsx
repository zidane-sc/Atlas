"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { List, Map as MapIcon } from "lucide-react";
import { listNotesAction, deleteNoteAction, updateNoteAction } from "@/lib/actions/notes";
import { useNotifications } from "@/hooks/useNotifications";
import { NoteList } from "@/components/notes/NoteList";
import { NoteEditorLazy } from "@/components/notes/NoteEditorLazy";
import { DeleteConfirmModal } from "@/components/notes/DeleteConfirmModal";
import { KnowledgeMap } from "@/components/notes/KnowledgeMap";
import type { NotePreview } from "@/types/note";

export default function NotesPage() {
  const searchParams = useSearchParams();
  const { notify } = useNotifications();
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; noteId: string | null; title: string }>({ isOpen: false, noteId: null, title: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [search, selectedTags]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) {
      setEditingNoteId(editId);
    }
  }, [searchParams]);

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

  const handleDelete = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (note) {
      setDeleteModal({ isOpen: true, noteId: id, title: note.title });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.noteId) return;

    setIsDeleting(true);
    try {
      await deleteNoteAction(deleteModal.noteId);
      setNotes(notes.filter((n) => n.id !== deleteModal.noteId));
      setDeleteModal({ isOpen: false, noteId: null, title: "" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectNote = (note: NotePreview) => {
    setEditingNoteId(note.id);
  };

  const handlePinNote = async (id: string, pinned: boolean) => {
    const note = notes.find((n) => n.id === id);
    await updateNoteAction({ noteId: id, pinned });
    setNotes(notes.map((n) => (n.id === id ? { ...n, pinned } : n)));
    notify(`📌 ${pinned ? "Pinned" : "Unpinned"}: "${note?.title}"`, "success");
  };

  const handleSaveNote = async () => {
    setEditingNoteId(null);
    setIsCreating(false);
    await loadNotes();
  };

  if (editingNoteId || isCreating) {
    return (
      <NoteEditorLazy
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
    <>
      <DeleteConfirmModal
        noteTitle={deleteModal.title}
        isOpen={deleteModal.isOpen}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, noteId: null, title: "" })}
      />
      <div className="flex h-full flex-col">
        <div className="px-6 py-3 border-b-2 bg-panel-alt" style={{ borderColor: "var(--color-primary-gold)" }}>
          <h1 className="font-display text-sm tracking-wide" style={{ color: "var(--color-primary-gold)" }}>
            📚 NOTES
          </h1>
        </div>

      <div className="flex-1 flex flex-col gap-4 p-6 overflow-hidden">
        <div className="flex gap-2">
          {viewMode === "list" ? (
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded bg-card text-sm"
            />
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <List size={14} /> List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
                viewMode === "map" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <MapIcon size={14} /> Knowledge Map
            </button>
          </div>
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

        {viewMode === "map" ? (
          <KnowledgeMap selectedTags={selectedTags} onOpenNote={(id) => setEditingNoteId(id)} />
        ) : loading ? (
          <div className="flex items-center justify-center flex-1">Loading...</div>
        ) : (
          <NoteList notes={notes} onSelectNote={handleSelectNote} onDeleteNote={handleDelete} onPinNote={handlePinNote} />
        )}
      </div>
      </div>
    </>
  );
}
