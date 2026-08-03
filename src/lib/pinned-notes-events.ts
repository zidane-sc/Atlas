/** Bridges note-pin changes between the Notes page and the Sidebar's Companion pinboard —
 * they hold separate local `pinned` state with no shared context. */
type Listener = () => void;

let listeners: Listener[] = [];

export const pinnedNotesEmitter = {
  subscribe(listener: Listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  emit() {
    listeners.forEach((listener) => listener());
  },
};
