'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { NotificationPayload } from '@/components/providers/NotificationProvider';
import { getNotificationMessage, shouldPlaySound } from '@/lib/notification-events';
import { useSettings } from '@/components/providers/SettingsProvider';

export function NotificationQueue({
  notifications,
  onDismiss,
}: {
  notifications: NotificationPayload[];
  onDismiss: (id: string) => void;
}) {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (notifications.length === 0) return;

    const latest = notifications[0];
    if (shouldPlaySound(latest.event) && settings.soundEnabled) {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            // Silent fail if audio fails
          });
        }
      } catch (err) {
        // Silent fail
      }
    }
  }, [notifications, settings.soundEnabled]);

  return (
    <>
      <audio ref={audioRef} src="/sounds/notification.mp3" />
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {notifications.map((notification) => {
          const { icon, text } = getNotificationMessage(notification.event);
          return (
            <div
              key={notification.id}
              className="flex items-center gap-3 bg-[var(--color-bg-panel)] border-2 border-[var(--color-primary-gold)] px-4 py-3 font-mono text-sm pointer-events-auto"
              style={{
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="text-base flex-shrink-0">{icon}</span>
              <span className="flex-1 truncate">{text}</span>
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
    </>
  );
}
