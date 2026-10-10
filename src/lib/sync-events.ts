import { db } from "@/lib/db";

export type SyncEventType =
  | "task:created"
  | "task:updated"
  | "task:deleted"
  | "timer:started"
  | "timer:stopped"
  | "timer:switched"
  | "settings:updated"
  | "sync:reload";

export interface SyncEvent {
  id?: string;
  type: SyncEventType;
  userId: string;
  data?: any;
  timestamp: number;
}

type Listener = (event: SyncEvent) => void;

// In-memory listener registry (active connections within the same Node worker)
const listenersByUser = new Map<string, Set<Listener>>();

export function subscribeToSyncEvents(userId: string, listener: Listener): () => void {
  let userListeners = listenersByUser.get(userId);
  if (!userListeners) {
    userListeners = new Set();
    listenersByUser.set(userId, userListeners);
  }
  userListeners.add(listener);

  return () => {
    const set = listenersByUser.get(userId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        listenersByUser.delete(userId);
      }
    }
  };
}

export async function broadcastSyncEvent(userId: string, type: SyncEventType, data?: any): Promise<void> {
  const timestamp = Date.now();
  const event: SyncEvent = {
    type,
    userId,
    data,
    timestamp,
  };

  // 1. In-process dispatch (0ms latency for connections on this worker)
  const userListeners = listenersByUser.get(userId);
  if (userListeners && userListeners.size > 0) {
    for (const listener of userListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Failed to deliver sync event to local listener:", err);
      }
    }
  }

  // 2. Persistent Postgres Event Bus for serverless multi-device & cross-container SSE
  try {
    const record = await db.syncEvent.create({
      data: {
        userId,
        type,
        data: data ? (data as any) : undefined,
      },
      select: { id: true },
    });
    event.id = record.id;

    // Prune stale events older than 2 hours occasionally (10% chance per write)
    if (Math.random() < 0.1) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      db.syncEvent.deleteMany({
        where: { userId, createdAt: { lt: twoHoursAgo } },
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to persist sync event to Postgres:", err);
  }
}
