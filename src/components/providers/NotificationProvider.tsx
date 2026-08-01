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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

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

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
      <NotificationQueue notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}
