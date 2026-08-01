import dynamic from "next/dynamic";
import { Suspense } from "react";

const NoteEditorContent = dynamic(
  () => import("./NoteEditor").then((mod) => mod.NoteEditor),
  {
    loading: () => (
      <div className="space-y-3 p-4">
        <div className="h-10 bg-muted-foreground/20 rounded animate-pulse" />
        <div className="h-64 bg-muted-foreground/20 rounded animate-pulse" />
        <div className="flex gap-2 justify-end">
          <div className="h-10 w-24 bg-muted-foreground/20 rounded animate-pulse" />
          <div className="h-10 w-24 bg-muted-foreground/20 rounded animate-pulse" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

interface NoteEditorLazyProps {
  noteId?: string;
  initialData?: any;
  onSave?: (note: any) => void;
  onClose?: () => void;
}

export function NoteEditorLazy(props: NoteEditorLazyProps) {
  return (
    <Suspense fallback={<div className="p-4">Loading editor...</div>}>
      <NoteEditorContent {...props} />
    </Suspense>
  );
}
