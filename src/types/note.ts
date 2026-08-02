export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotePreview {
  id: string;
  title: string;
  preview: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  linkedTaskCount: number;
}

export interface Attachment {
  id: string;
  noteId: string;
  url: string;
  fileName: string;
  fileType?: string;
  createdAt: string;
}

export interface NoteWithMeta {
  note: Note;
  attachments: Attachment[];
  linkedTasks: {
    id: string;
    title: string;
  }[];
  linkedNotes: {
    id: string;
    title: string;
  }[];
}
