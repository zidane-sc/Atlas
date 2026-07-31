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
  const [tagError, setTagError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  const handleAutoSave = useCallback(async () => {
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
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, noteId]);

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
    saveTimeoutRef.current = setTimeout(handleAutoSave, 500);
  }, [handleAutoSave]);

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
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
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
    debouncedSave();
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;

    const newTag = tagInput.trim().startsWith("#") ? tagInput.trim() : `#${tagInput.trim()}`;

    if (!tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput("");
      debouncedSave();
      setTagError(null);
    } else {
      setTagError(`Tag ${newTag} already exists`);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setTagError(null), 3000);
    }
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-full flex-col border-2 border-gray-600 shadow-lg" style={{ backgroundColor: "var(--color-bg-panel)" }}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b-2" style={{ borderColor: "var(--color-primary-gold)" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            debouncedSave();
          }}
          placeholder="Note title..."
          className="flex-1 font-display text-lg bg-transparent border-none outline-none"
          style={{ color: "var(--color-foreground)" }}
        />
        <div className="text-xs text-muted-foreground ml-2">
          {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved}` : ""}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 px-2 py-1 border border-gray-500 rounded hover:border-primary-gold transition-all"
            style={{ color: "var(--color-primary-gold)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Left */}
        <div className="flex flex-col flex-1 border-r-2" style={{ borderColor: "var(--color-primary-gold)" }}>
          <div className="px-3 py-2 border-b border-gray-600" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
            <span className="text-xs font-display" style={{ color: "var(--color-primary-gold)" }}>
              📝 EDITOR
            </span>
          </div>
          <MarkdownToolbar onInsert={handleInsertMarkdown} />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              debouncedSave();
            }}
            onBlur={handleAutoSave}
            placeholder="Write markdown..."
            className="flex-1 p-4 font-mono text-sm bg-panel text-foreground border-none outline-none resize-none"
          />
        </div>

        {/* Preview Right */}
        <div className="flex-1 border-l-2 overflow-hidden" style={{ borderColor: "var(--color-primary-gold)" }}>
          <div className="px-3 py-2 border-b border-gray-600" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
            <span className="text-xs font-display" style={{ color: "var(--color-primary-gold)" }}>
              👁️ PREVIEW
            </span>
          </div>
          <MarkdownPreview content={content} />
        </div>
      </div>

      {/* Footer with Tags & Gamification */}
      <div className="border-t-2" style={{ borderColor: "var(--color-primary-gold)" }}>
        <div className="px-3 py-2 border-b border-gray-600" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
          <span className="text-xs font-display" style={{ color: "var(--color-primary-gold)" }}>
            🏷️ TAGS & INFO
          </span>
        </div>
        <div className="flex items-center gap-3 p-4 text-xs text-muted-foreground">
          <div className="flex-1">
            <div className="flex gap-2 flex-wrap mb-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded">
                  {tag}
                  <button
                    type="button"
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
            <div className="flex gap-1">
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
                className="px-2 py-1 border border-gray-500 rounded bg-panel text-xs flex-1"
                style={{ color: "var(--color-foreground)" }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1 border-2 rounded bg-panel text-foreground hover:bg-panel-alt text-xs font-display transition-all active:scale-95"
                style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
              >
                Add
              </button>
            </div>
            {tagError && (
              <div className="text-xs mt-1 px-2 py-1 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid #ef4444" }}>
                ⚠️ {tagError}
              </div>
            )}
          </div>
        </div>
        <GamificationFooter wordCount={wordCount} hasStreak={false} />
      </div>
    </div>
  );
}
