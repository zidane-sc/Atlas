"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createNoteAction, updateNoteAction } from "@/lib/actions/notes";
import type { Note, NoteWithMeta } from "@/types/note";

interface NoteEditorProps {
  noteId?: string;
  initialData?: NoteWithMeta;
  onSave?: (note: Note) => void;
  onClose?: () => void;
}

export function NoteEditor({ noteId, initialData, onSave, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(initialData?.note.title || "");
  const [content, setContent] = useState(initialData?.note.content || "");
  const [tags, setTags] = useState(initialData?.note.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      const result = noteId
        ? await updateNoteAction({
            noteId,
            title,
            content,
            tags,
          })
        : await createNoteAction({
            title,
            content,
            tags,
          });

      if (result.success) {
        setLastSaved(new Date().toLocaleTimeString());
        onSave?.(result.data!);
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, noteId, onSave]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(handleSave, 500);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
      debouncedSave();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            debouncedSave();
          }}
          placeholder="Note title..."
          className="flex-1 font-semibold text-lg bg-transparent border-none outline-none"
        />
        <div className="text-xs text-muted-foreground">{lastSaved && `Saved ${lastSaved}`}</div>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            debouncedSave();
          }}
          onBlur={handleSave}
          placeholder="Write your note in markdown..."
          className="flex-1 p-3 border border-border rounded bg-card text-sm font-mono resize-none"
        />

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Tags</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                  {tag}
                  <button
                    onClick={() => {
                      setTags(tags.filter((t) => t !== tag));
                      debouncedSave();
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag and press Enter..."
              className="w-full px-2 py-1 border border-border rounded bg-card text-xs"
            />
          </div>
          <button
            onClick={handleAddTag}
            className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
