"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createNoteAction, updateNoteAction, getNoteAction } from "@/lib/actions/notes";
import { insertMarkdown } from "@/lib/markdown";
import { useTasks } from "@/components/providers/TasksProvider";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { GamificationFooter } from "./GamificationFooter";
import type { Note, NoteWithMeta } from "@/types/note";
import type { Task } from "@/types/task";

interface NoteEditorProps {
  noteId?: string;
  initialData?: NoteWithMeta;
  onSave?: (note: Note) => void;
  onClose?: () => void;
}

export function NoteEditor({ noteId, initialData, onSave, onClose }: NoteEditorProps) {
  const { tasks } = useTasks();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initialData?.note.title || "");
  const [content, setContent] = useState(initialData?.note.content || "");
  const [tags, setTags] = useState(initialData?.note.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>(initialData?.linkedTasks.map((t) => t.id) || []);
  const [linkedTasks, setLinkedTasks] = useState<Array<{ id: string; title: string }>>(
    initialData?.linkedTasks || []
  );
  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData && !!noteId);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const noteCreatedRef = useRef<string | null>(null);

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
            taskIds,
          })
        : noteCreatedRef.current
        ? await updateNoteAction({
            noteId: noteCreatedRef.current as string,
            title,
            content,
            tags,
            taskIds,
          })
        : await createNoteAction({
            title,
            content,
            tags,
            taskIds,
          });

      if (result.success) {
        if (!noteId && result.data?.id && !noteCreatedRef.current) {
          noteCreatedRef.current = result.data.id;
        }
        setLastSaved(new Date().toLocaleTimeString());
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, taskIds, noteId]);

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
            taskIds,
          })
        : await createNoteAction({
            title,
            content,
            tags,
            taskIds,
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
      setLinkedTasks(initialData.linkedTasks);
      setTaskIds(initialData.linkedTasks.map((t) => t.id));
    }
  }, [initialData?.note.id]);

  useEffect(() => {
    if (noteId && !initialData) {
      const fetchNote = async () => {
        setIsLoading(true);
        try {
          const result = await getNoteAction(noteId);
          if (result.success && result.data?.note) {
            setTitle(result.data.note.title);
            setContent(result.data.note.content);
            setTags(result.data.note.tags);
            setLinkedTasks(result.data.linkedTasks);
            setTaskIds(result.data.linkedTasks.map((t) => t.id));
          }
        } finally {
          setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="flex h-full flex-col border-2 border-gray-600 shadow-lg items-center justify-center" style={{ backgroundColor: "var(--color-bg-panel)" }}>
        <div className="text-center">
          <div className="text-xl font-display mb-2" style={{ color: "var(--color-primary-gold)" }}>
            📖
          </div>
          <div className="text-sm text-muted-foreground font-display">Loading note...</div>
          <div className="mt-2 flex gap-1 justify-center">
            <div
              className="w-1 h-1 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-primary-gold)" }}
            />
            <div
              className="w-1 h-1 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-primary-gold)", animationDelay: "100ms" }}
            />
            <div
              className="w-1 h-1 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-primary-gold)", animationDelay: "200ms" }}
            />
          </div>
        </div>
      </div>
    );
  }

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
            onClick={() => {
              if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
              if (title.trim() && content.trim()) {
                onSave?.({ id: noteId || noteCreatedRef.current || "", title, content, tags, pinned: false, userId: "", createdAt: "", updatedAt: "" });
              }
              onClose();
            }}
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
        <div className="px-3 py-2 border-b-2 border-gray-600 flex gap-2" style={{ backgroundColor: "var(--color-bg-panel-alt)", borderBottomColor: "var(--color-primary-gold)" }}>
          <span className="text-xs font-display" style={{ color: "var(--color-primary-gold)" }}>
            🏷️ ATTRIBUTES
          </span>
        </div>
        <div className="p-3 text-xs grid grid-cols-2 gap-4">
          {/* Tags Column */}
          <div className="border-r border-gray-600 pr-3">
            <div className="mb-2 text-xs font-display tracking-widest" style={{ color: "var(--color-primary-gold)" }}>
              TAGS
            </div>
            <div className="flex gap-1.5 flex-wrap mb-2 min-h-6">
              {tags.slice(0, 3).map((tag) => (
                <div
                  key={tag}
                  className="px-2 py-1 border-2 rounded flex items-center gap-1 text-xs font-display transition-all hover:scale-110 active:scale-95 group"
                  style={{
                    borderColor: "var(--color-primary-gold)",
                    backgroundColor: "var(--color-primary-gold)/10",
                    color: "var(--color-primary-gold)",
                  }}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTags(tags.filter((t) => t !== tag));
                      debouncedSave();
                    }}
                    className="opacity-60 group-hover:opacity-100 transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {tags.length > 3 && (
                <div
                  className="px-2 py-1 text-xs font-display"
                  style={{ color: "var(--color-primary-gold)" }}
                >
                  +{tags.length - 3}
                </div>
              )}
            </div>
            <div className="flex gap-1 mt-2">
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
                placeholder="#tag"
                className="px-2 py-1 border-2 rounded bg-panel text-xs flex-1 transition-all focus:border-primary-gold"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-2 py-1 border-2 rounded font-display text-xs transition-all active:scale-95 hover:shadow-lg"
                style={{
                  borderColor: "var(--color-primary-gold)",
                  backgroundColor: "var(--color-primary-gold)/10",
                  color: "var(--color-primary-gold)",
                }}
              >
                ADD
              </button>
            </div>
            {tagError && (
              <div className="text-xs mt-2 px-2 py-1 rounded border-2" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderColor: "#ef4444" }}>
                ⚠️ {tagError}
              </div>
            )}
          </div>

          {/* Linked Tasks Column */}
          <div>
            <div className="mb-2 text-xs font-display tracking-widest" style={{ color: "var(--color-primary-gold)" }}>
              QUESTS ({linkedTasks.length})
            </div>
            <div className="space-y-1.5 mb-2 min-h-6">
              {linkedTasks.slice(0, 2).map((task) => {
                const linkedTask = tasks.find((t) => t.id === task.id);
                const priorityColor =
                  linkedTask?.priority === "p0"
                    ? "--color-priority-p0"
                    : linkedTask?.priority === "p1"
                      ? "--color-priority-p1"
                      : "--color-primary-gold";
                const statusEmoji =
                  linkedTask?.status === "done"
                    ? "✓"
                    : linkedTask?.status === "in_progress"
                      ? "▶"
                      : linkedTask?.status === "blocked"
                        ? "⊘"
                        : "○";

                return (
                  <div
                    key={task.id}
                    className="px-2 py-1 border-2 rounded flex items-center gap-2 text-xs transition-all hover:shadow-md hover:scale-105 group"
                    style={{
                      borderColor: `var(${priorityColor})`,
                      backgroundColor: `var(${priorityColor})/5`,
                      color: "var(--color-foreground)",
                    }}
                  >
                    <span
                      className="font-bold text-sm flex-shrink-0 w-5 h-5 flex items-center justify-center rounded"
                      style={{
                        color: `var(${priorityColor})`,
                        backgroundColor: `var(${priorityColor})/20`,
                      }}
                    >
                      {statusEmoji}
                    </span>
                    <span className="truncate text-xs flex-1 font-semibold">{task.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newTaskIds = taskIds.filter((id) => id !== task.id);
                        setTaskIds(newTaskIds);
                        setLinkedTasks(linkedTasks.filter((t) => t.id !== task.id));
                        debouncedSave();
                      }}
                      className="opacity-60 group-hover:opacity-100 transition-all text-xs"
                      style={{ color: `var(${priorityColor})` }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {linkedTasks.length > 2 && (
                <div className="text-xs px-2 py-1 font-display" style={{ color: "var(--color-primary-gold)" }}>
                  +{linkedTasks.length - 2} more
                </div>
              )}
            </div>

            {/* Task Search Input */}
            <div className="relative">
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                onFocus={() => setShowTaskPicker(true)}
                onBlur={() => setTimeout(() => setShowTaskPicker(false), 100)}
                placeholder="quest..."
                className="w-full px-2 py-0.5 border border-gray-500 rounded bg-panel text-xs font-display transition-all"
                style={{
                  borderColor: showTaskPicker ? "var(--color-primary-gold)" : "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />

              {/* Task Picker Dropdown */}
              {showTaskPicker && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 border border-gray-500 rounded bg-panel overflow-hidden z-50 shadow-lg"
                  style={{ borderColor: "var(--color-primary-gold)" }}
                >
                  <div
                    className="max-h-32 overflow-y-auto"
                    style={{ backgroundColor: "var(--color-bg-panel)" }}
                  >
                    {tasks
                      .filter(
                        (task) =>
                          !taskIds.includes(task.id) &&
                          task.title.toLowerCase().includes(taskSearch.toLowerCase())
                      )
                      .slice(0, 6)
                      .map((task, idx, arr) => {
                        const priorityColor =
                          task.priority === "p0"
                            ? "--color-priority-p0"
                            : task.priority === "p1"
                              ? "--color-priority-p1"
                              : "--color-primary-gold";

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTaskIds([...taskIds, task.id]);
                              setLinkedTasks([...linkedTasks, { id: task.id, title: task.title }]);
                              setTaskSearch("");
                              setShowTaskPicker(false);
                              debouncedSave();
                            }}
                            className="w-full text-left px-2 py-1 transition-all text-xs hover:bg-primary/20"
                            style={{
                              borderBottom:
                                idx < arr.length - 1
                                  ? "1px solid var(--color-border)"
                                  : "none",
                              color: "var(--color-foreground)",
                            }}
                          >
                            <div className="truncate">
                              {task.title}
                              <span
                                className="ml-1 px-1 rounded text-xs font-display"
                                style={{
                                  backgroundColor: `var(${priorityColor})/20`,
                                  color: `var(${priorityColor})`,
                                }}
                              >
                                {task.priority.toUpperCase()}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    {tasks.filter(
                      (task) =>
                        !taskIds.includes(task.id) &&
                        task.title.toLowerCase().includes(taskSearch.toLowerCase())
                    ).length === 0 && (
                      <div
                        className="px-2 py-1 text-xs text-center font-display"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {taskSearch ? "No results" : "No quests"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <GamificationFooter wordCount={wordCount} hasStreak={false} />
      </div>
    </div>
  );
}
