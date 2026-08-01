'use client';

import { useContext, useCallback } from 'react';
import type { NotificationEvent } from '@/lib/notification-events';

export interface NotificationContextValue {
  notifications: Array<{ id: string; event: NotificationEvent; timestamp: number }>;
}

let notificationListeners: Array<(event: NotificationEvent) => void> = [];

export const notificationEmitter = {
  subscribe(listener: (event: NotificationEvent) => void) {
    notificationListeners.push(listener);
    return () => {
      notificationListeners = notificationListeners.filter(l => l !== listener);
    };
  },
  emit(event: NotificationEvent) {
    notificationListeners.forEach(listener => listener(event));
  },
};

// NotificationContext for provider
import { createContext } from 'react';
export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const emit = useCallback((event: NotificationEvent) => {
    notificationEmitter.emit(event);
  }, []);

  return { emit };
}
