'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { notificationEmitter, NotificationContext } from '@/hooks/useNotifications';
import { NotificationQueue } from '@/components/notifications/NotificationQueue';
import type { NotificationEvent } from '@/lib/notification-events';

export interface NotificationPayload {
  id: string;
  event: NotificationEvent;
  timestamp: number;
}

export interface UndoState {
  taskId: string;
  previousDate: string;
  newDate: string;
  timeoutId: NodeJS.Timeout;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  useEffect(() => {
    const unsubscribe = notificationEmitter.subscribe((event: NotificationEvent) => {
      const id = crypto.randomUUID();
      const payload: NotificationPayload = {
        id,
        event,
        timestamp: Date.now(),
      };

      setNotifications(prev => {
        const next = [payload, ...prev];
        if (next.length > 5) {
          return next.slice(0, 5);
        }
        return next;
      });

      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);

      return () => clearTimeout(timer);
    });

    return unsubscribe;
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const [undoCallback, setUndoCallback] = useState<(() => void) | null>(null);

  const handleUndo = useCallback(() => {
    if (undoState?.timeoutId) {
      clearTimeout(undoState.timeoutId);
    }
    // Call the registered undo callback if it exists
    if (undoCallback) {
      undoCallback();
    }
    setUndoState(null);
  }, [undoState, undoCallback]);

  return (
    <NotificationContext.Provider value={{ notifications, undoState, setUndoState, setUndoCallback }}>
      {children}
      <NotificationQueue notifications={notifications} onDismiss={dismiss} lastReschedule={undoState} onUndo={handleUndo} />
    </NotificationContext.Provider>
  );
}
