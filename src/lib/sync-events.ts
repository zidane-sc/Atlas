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
  type: SyncEventType;
  userId: string;
  data?: any;
  timestamp: number;
}

type Listener = (event: SyncEvent) => void;

// In-memory listener registry (shared in Node process)
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

export function broadcastSyncEvent(userId: string, type: SyncEventType, data?: any): void {
  const userListeners = listenersByUser.get(userId);
  if (!userListeners || userListeners.size === 0) return;

  const event: SyncEvent = {
    type,
    userId,
    data,
    timestamp: Date.now(),
  };

  for (const listener of userListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("Failed to deliver sync event to listener:", err);
    }
  }
}
