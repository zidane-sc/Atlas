"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createNoteAction, updateNoteAction, getNoteAction, linkNotesAction, unlinkNotesAction, listNotesAction } from "@/lib/actions/notes";
import { insertMarkdown } from "@/lib/markdown";
import { useTasks } from "@/components/providers/TasksProvider";
import { useNotifications } from "@/hooks/useNotifications";
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
  const { notify } = useNotifications();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const taskSearchRef = useRef<HTMLInputElement>(null);
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
  const [linkedNotes, setLinkedNotes] = useState<Array<{ id: string; title: string }>>(
    initialData?.linkedNotes || []
  );
  const [noteLinkSearch, setNoteLinkSearch] = useState("");
  const [showNoteLinkPicker, setShowNoteLinkPicker] = useState(false);
  const [noteLinkResults, setNoteLinkResults] = useState<Array<{ id: string; title: string }>>([]);
  const noteLinkSearchRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData && !!noteId);
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const noteCreatedRef = useRef<string | null>(null);
  // Mirrors noteCreatedRef into state — reading a ref's .current during render (for
  // currentNoteId below) breaks React's rules and won't re-render when it changes.
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);

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
          setCreatedNoteId(result.data.id);
        }
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        notify(result.error?.message ?? "Autosave failed — your changes aren't saved yet.", "error");
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, taskIds, noteId, notify]);

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
      } else {
        notify(result.error?.message ?? "Failed to save note.", "error");
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, noteId, onSave, notify]);

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
      setLinkedNotes(initialData.linkedNotes);
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
            setLinkedNotes(result.data.linkedNotes);
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

  useEffect(() => {
    if (taskIds.length > 0 || linkedTasks.length > 0) {
      debouncedSave();
    }
  }, [taskIds.length, linkedTasks.length]);

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

  const currentNoteId = noteId || createdNoteId;

  useEffect(() => {
    if (!showNoteLinkPicker) return;
    const timeoutId = setTimeout(async () => {
      const result = await listNotesAction({ search: noteLinkSearch || undefined, take: 8 });
      if (result.success) {
        const excluded = new Set([currentNoteId, ...linkedNotes.map((n) => n.id)]);
        setNoteLinkResults(
          result.data.notes.filter((n) => !excluded.has(n.id)).map((n) => ({ id: n.id, title: n.title }))
        );
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [showNoteLinkPicker, noteLinkSearch, currentNoteId, linkedNotes]);

  const handleLinkNote = async (target: { id: string; title: string }) => {
    if (!currentNoteId) return;
    setLinkedNotes((prev) => [...prev, target]);
    setNoteLinkSearch("");
    const result = await linkNotesAction(currentNoteId, target.id);
    if (!result.success) {
      setLinkedNotes((prev) => prev.filter((n) => n.id !== target.id));
    }
  };

  const handleUnlinkNote = async (targetId: string) => {
    if (!currentNoteId) return;
    const prev = linkedNotes;
    setLinkedNotes((p) => p.filter((n) => n.id !== targetId));
    const result = await unlinkNotesAction(currentNoteId, targetId);
    if (!result.success) {
      setLinkedNotes(prev);
    }
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

      {/* Mobile Editor/Preview Tabs */}
      <div className="flex md:hidden border-b-2" style={{ borderColor: "var(--color-primary-gold)" }}>
        <button
          type="button"
          onClick={() => setMobileTab("editor")}
          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-display transition-colors ${
            mobileTab === "editor" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          📝 Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-display transition-colors ${
            mobileTab === "preview" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          👁️ Preview
        </button>
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Editor Left */}
        <div className={`${mobileTab === "editor" ? "flex" : "hidden"} md:flex flex-col flex-1 min-h-0 border-b-2 md:border-b-0 md:border-r-2`} style={{ borderColor: "var(--color-primary-gold)" }}>
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
            className="flex-1 min-h-[200px] p-4 font-mono text-sm bg-panel text-foreground border-none outline-none resize-none"
          />
        </div>

        {/* Preview Right */}
        <div className={`${mobileTab === "preview" ? "block" : "hidden"} md:block flex-1 min-h-0 md:border-l-2 overflow-hidden`} style={{ borderColor: "var(--color-primary-gold)" }}>
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
            🏷️ TAGS & LINKS
          </span>
        </div>
        <div className="p-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Tags Column */}
          <div className="flex flex-col">
            <div className="flex gap-1 flex-wrap mb-2 max-h-12 overflow-y-auto flex-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded border border-gray-500 text-xs flex items-center gap-1 group hover:border-primary-gold transition-colors flex-shrink-0"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      setTags(tags.filter((t) => t !== tag));
                      debouncedSave();
                    }}
                    className="opacity-50 group-hover:opacity-100"
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
                placeholder="tag"
                className="px-2 py-0.5 border border-gray-500 rounded bg-panel text-xs flex-1"
                style={{ color: "var(--color-foreground)" }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-2 py-0.5 border border-primary-gold rounded text-xs font-display"
                style={{ color: "var(--color-primary-gold)" }}
              >
                +
              </button>
            </div>
            {tagError && (
              <div className="text-xs mt-1 px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid #ef4444" }}>
                ⚠️ {tagError}
              </div>
            )}
          </div>

          {/* Linked Tasks Column */}
          <div className="flex flex-col">
            {linkedTasks.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2 max-h-12 overflow-y-auto">
                {linkedTasks.map((task) => {
                  const linkedTask = tasks.find((t) => t.id === task.id);
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
                      className="px-1.5 py-0.5 rounded border border-gray-500 flex items-center gap-0.5 text-xs group hover:border-primary-gold transition-colors flex-shrink-0"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      <span className="text-xs">{statusEmoji}</span>
                      <span className="truncate max-w-[80px] text-xs">{task.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newTaskIds = taskIds.filter((id) => id !== task.id);
                          setTaskIds(newTaskIds);
                          setLinkedTasks(linkedTasks.filter((t) => t.id !== task.id));
                          debouncedSave();
                        }}
                        className="opacity-50 group-hover:opacity-100 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Task Search Input */}
            <div className="relative">
              <input
                ref={taskSearchRef}
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                onFocus={() => setShowTaskPicker(true)}
                onBlur={() => setTimeout(() => setShowTaskPicker(false), 150)}
                placeholder="quest"
                className="w-full px-1.5 py-0.25 border border-gray-500 rounded bg-panel text-xs transition-all"
                style={{
                  borderColor: showTaskPicker ? "var(--color-primary-gold)" : "var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />

              {/* Task Picker Dropdown */}
              {showTaskPicker && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-0.5 border border-gray-500 rounded bg-panel overflow-hidden z-50"
                  style={{ borderColor: "var(--color-primary-gold)" }}
                >
                  <div
                    className="max-h-48 overflow-y-auto"
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

                        const statusLabel =
                          task.status === "done"
                            ? "Done"
                            : task.status === "in_progress"
                              ? "In Progress"
                              : task.status === "blocked"
                                ? "Blocked"
                                : task.status === "ready"
                                  ? "Ready"
                                  : task.status === "inbox"
                                    ? "Inbox"
                                    : task.status.charAt(0).toUpperCase() + task.status.slice(1);

                        return (
                          <button
                            key={task.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTaskIds([...taskIds, task.id]);
                              setLinkedTasks([...linkedTasks, { id: task.id, title: task.title }]);
                              setTaskSearch("");
                              debouncedSave();
                              setTimeout(() => taskSearchRef.current?.focus(), 0);
                            }}
                            className="w-full text-left px-1.5 py-1 transition-all text-xs hover:bg-primary/20 flex items-center gap-1.5"
                            style={{
                              borderBottom:
                                idx < arr.length - 1
                                  ? "1px solid var(--color-border)"
                                  : "none",
                              color: "var(--color-foreground)",
                            }}
                          >
                            <span className="text-xs flex-shrink-0 px-1 rounded" style={{ backgroundColor: `var(${priorityColor})/20`, color: `var(${priorityColor})` }}>
                              {statusLabel}
                            </span>
                            <span className="truncate flex-1">{task.title}</span>
                            {task.project && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {task.project}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(task.dueDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                            <span
                              className="px-0.5 rounded text-xs flex-shrink-0"
                              style={{
                                backgroundColor: `var(${priorityColor})/20`,
                                color: `var(${priorityColor})`,
                              }}
                            >
                              {task.priority.toUpperCase()}
                            </span>
                          </button>
                        );
                      })}
                    {tasks.filter(
                      (task) =>
                        !taskIds.includes(task.id) &&
                        task.title.toLowerCase().includes(taskSearch.toLowerCase())
                    ).length === 0 && (
                      <div
                        className="px-1.5 py-0.5 text-xs text-center"
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

        {/* Linked Notes — docs/01-product.md §14 note-to-note linking */}
        <div className="px-3 pb-3 text-xs">
          <div className="mb-1" style={{ color: "var(--color-text-muted)" }}>🔗 Linked Notes</div>
          {!currentNoteId ? (
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Save this note first to link it to others.</div>
          ) : (
            <>
              {linkedNotes.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2 max-h-12 overflow-y-auto">
                  {linkedNotes.map((n) => (
                    <div
                      key={n.id}
                      className="px-1.5 py-0.5 rounded border border-gray-500 flex items-center gap-0.5 text-xs group hover:border-primary-gold transition-colors flex-shrink-0"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      <span className="truncate max-w-[120px] text-xs">{n.title}</span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkNote(n.id)}
                        className="opacity-50 group-hover:opacity-100 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  ref={noteLinkSearchRef}
                  type="text"
                  value={noteLinkSearch}
                  onChange={(e) => setNoteLinkSearch(e.target.value)}
                  onFocus={() => setShowNoteLinkPicker(true)}
                  onBlur={() => setTimeout(() => setShowNoteLinkPicker(false), 150)}
                  placeholder="link a note..."
                  className="w-full max-w-xs px-1.5 py-0.25 border border-gray-500 rounded bg-panel text-xs transition-all"
                  style={{
                    borderColor: showNoteLinkPicker ? "var(--color-primary-gold)" : "var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
                {showNoteLinkPicker && (
                  <div
                    className="absolute bottom-full left-0 w-full max-w-xs mb-0.5 border border-gray-500 rounded bg-panel overflow-hidden z-50"
                    style={{ borderColor: "var(--color-primary-gold)" }}
                  >
                    <div className="max-h-48 overflow-y-auto" style={{ backgroundColor: "var(--color-bg-panel)" }}>
                      {noteLinkResults.map((n, idx, arr) => (
                        <button
                          key={n.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleLinkNote(n);
                            setTimeout(() => noteLinkSearchRef.current?.focus(), 0);
                          }}
                          className="w-full text-left px-1.5 py-1 transition-all text-xs hover:bg-primary/20 truncate"
                          style={{
                            borderBottom: idx < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                            color: "var(--color-foreground)",
                          }}
                        >
                          {n.title}
                        </button>
                      ))}
                      {noteLinkResults.length === 0 && (
                        <div className="px-1.5 py-0.5 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                          {noteLinkSearch ? "No results" : "No other notes"}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <GamificationFooter wordCount={wordCount} hasStreak={false} />
      </div>
    </div>
  );
}
