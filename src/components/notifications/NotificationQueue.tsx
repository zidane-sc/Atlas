'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import type { NotificationPayload } from '@/components/providers/NotificationProvider';
import { getNotificationMessage, shouldPlaySound } from '@/lib/notification-events';
import { playRetroBlip } from '@/lib/audio';

export function NotificationQueue({
  notifications,
  onDismiss,
  lastReschedule,
  onUndo,
}: {
  notifications: NotificationPayload[];
  onDismiss: (id: string) => void;
  lastReschedule?: {
    taskId: string;
    previousDate: string;
    newDate: string;
    timeoutId: NodeJS.Timeout;
  } | null;
  onUndo?: () => void;
}) {
  const settings = useSettings();
  const lastPlayedIdRef = useRef<string | null>(null);

  const notificationsEnabled = typeof settings === 'object' && 'notificationsEnabled' in settings ? settings.notificationsEnabled : true;
  const soundEnabled = typeof settings === 'object' && 'soundEnabled' in settings ? settings.soundEnabled : true;

  useEffect(() => {
    if (!notificationsEnabled || notifications.length === 0) return;

    const latest = notifications[0];
    if (latest.id === lastPlayedIdRef.current) return;

    if (shouldPlaySound(latest.event) && soundEnabled) {
      playRetroBlip();
      lastPlayedIdRef.current = latest.id;
    }
  }, [notifications, notificationsEnabled, soundEnabled]);

  if (!notificationsEnabled || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {notifications.map((notification) => {
          const { icon, text } = getNotificationMessage(notification.event);
          const isRescheduledEvent = notification.event.type === 'task:rescheduled';
          const showUndoButton = isRescheduledEvent && lastReschedule && onUndo;
          return (
            <div
              key={notification.id}
              className="flex items-center gap-3 bg-[var(--color-bg-panel)] border-2 border-[var(--color-primary-gold)] px-4 py-3 font-mono text-sm pointer-events-auto animate-in slide-in-from-top-2 fade-in duration-150 shadow-[4px_4px_0_rgba(0,0,0,0.8)]"
              style={{
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="text-base flex-shrink-0">{icon}</span>
              <span className="flex-1 truncate">{text}</span>
              {showUndoButton && (
                <button
                  onClick={onUndo}
                  className="ml-2 px-2 py-1 border border-current hover:bg-white/10 text-xs flex-shrink-0"
                  aria-label="Undo reschedule"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => onDismiss(notification.id)}
                className="ml-2 hover:opacity-70 flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
  );
}
