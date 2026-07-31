"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createNoteAction, updateNoteAction, getNoteAction } from "@/lib/actions/notes";
import { insertMarkdown } from "@/lib/markdown";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { GamificationFooter } from "./GamificationFooter";
import type { Note, NoteWithMeta } from "@/types/note";

interface NoteEditorProps {
  noteId?: string;
  initialData?: NoteWithMeta;
  onSave?: (note: Note) => void;
  onClose?: () => void;
}

export function NoteEditor({ noteId, initialData, onSave, onClose }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (initialData?.note) {
      setTitle(initialData.note.title);
      setContent(initialData.note.content);
      setTags(initialData.note.tags);
    }
  }, [initialData?.note.id]);

  useEffect(() => {
    if (noteId && !initialData) {
      const fetchNote = async () => {
        const result = await getNoteAction(noteId);
        if (result.success && result.data?.note) {
          setTitle(result.data.note.title);
          setContent(result.data.note.content);
          setTags(result.data.note.tags);
        }
      };
      fetchNote();
    }
  }, [noteId, initialData]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleInsertMarkdown = (syntax: any, isBlock?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;

    let result;
    if (isBlock) {
      const lineStart = text.lastIndexOf("\n", start) + 1;
      const lineText = text.slice(lineStart, end);
      result = {
        newText: text.slice(0, lineStart) + syntax.before + lineText + text.slice(end),
        newCursorPos: lineStart + syntax.before.length + lineText.length,
      };
    } else if (typeof syntax === "string") {
      result = {
        newText: text.slice(0, start) + syntax + text.slice(end),
        newCursorPos: start + syntax.length,
      };
    } else {
      result = insertMarkdown(text, start, end, syntax);
    }

    setContent(result.newText);
    setTimeout(() => {
      textarea.setSelectionRange(result.newCursorPos, result.newCursorPos);
      textarea.focus();
    }, 0);
    if (!noteId) debouncedSave();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      const newTag = tagInput.trim().startsWith("#") ? tagInput.trim() : `#${tagInput.trim()}`;
      setTags([...tags, newTag]);
      setTagInput("");
      if (!noteId) debouncedSave();
    }
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-full flex-col border-2 border-gray-600" style={{ backgroundColor: "var(--color-bg-panel)" }}>
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-600">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!noteId) debouncedSave();
          }}
          placeholder="Note title..."
          className="flex-1 font-display text-lg bg-transparent border-none outline-none"
          style={{ color: "var(--color-foreground)" }}
        />
        <div className="text-xs text-muted-foreground ml-2">
          {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved}` : ""}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        )}
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Left */}
        <div className="flex flex-col flex-1 border-r border-gray-600">
          <MarkdownToolbar onInsert={handleInsertMarkdown} />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (!noteId) debouncedSave();
            }}
            onBlur={handleSave}
            placeholder="Write markdown..."
            className="flex-1 p-4 font-mono text-sm bg-panel text-foreground border-none outline-none resize-none"
          />
        </div>

        {/* Preview Right */}
        <div className="flex-1 border-l border-gray-600 overflow-hidden">
          <MarkdownPreview content={content} />
        </div>
      </div>

      {/* Footer with Tags & Gamification */}
      <div className="border-t border-gray-600">
        <div className="flex items-center gap-3 p-3 text-xs text-muted-foreground">
          <div className="flex gap-2 flex-wrap flex-1">
            {tags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded">
                {tag}
                <button
                  type="button"
                  onClick={() => {
                    setTags(tags.filter((t) => t !== tag));
                    if (!noteId) debouncedSave();
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  ✕
                </button>
              </span>
            ))}
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
              placeholder="Add tag..."
              className="px-2 py-1 border border-gray-500 rounded bg-panel text-xs"
              style={{ color: "var(--color-foreground)" }}
            />
          </div>
        </div>
        <GamificationFooter wordCount={wordCount} hasStreak={false} />
      </div>
    </div>
  );
}
