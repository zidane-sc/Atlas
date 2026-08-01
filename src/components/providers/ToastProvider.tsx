"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const styles = `
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(400px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes toastFadeOut {
    to {
      opacity: 0;
      transform: translateX(400px);
    }
  }

  .toast-enter {
    animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-exit {
    animation: toastFadeOut 0.3s cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }

  .scroll-shadow {
    background:
      linear-gradient(to bottom, var(--color-bg-deep), transparent) 0% 0% / 100% 8px no-repeat,
      linear-gradient(to top, var(--color-bg-deep), transparent) 0% 100% / 100% 8px no-repeat;
    background-attachment: local, local;
  }
`;

type ToastKind = "success" | "error";

interface ToastEntry {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_COLOR_VAR: Record<ToastKind, string> = {
  success: "--color-status-ready",
  error: "--color-status-blocked",
};

/** Non-blocking feedback for actions that otherwise complete silently (export, import, reset). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    counter.current += 1;
    const id = `t${counter.current}`;
    setEntries((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setExiting((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setExiting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    }, 2700);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <style>{styles}</style>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
        {entries.map((e) => (
          <div
            key={e.id}
            role="status"
            className={`pointer-events-auto border-2 bg-card px-3 py-2 text-sm text-foreground ${exiting.has(e.id) ? "toast-exit" : "toast-enter"}`}
            style={{ borderColor: `var(${KIND_COLOR_VAR[e.kind]})`, boxShadow: "4px 4px 0 var(--color-bg-deep)" }}
          >
            <span style={{ color: `var(${KIND_COLOR_VAR[e.kind]})` }}>{e.kind === "success" ? "✓ " : "✕ "}</span>
            {e.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
