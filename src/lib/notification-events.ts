export type NotificationEvent =
  | { type: 'task:overdue'; taskId: string; title: string }
  | { type: 'task:due-soon'; taskId: string; title: string; dueDate: string }
  | { type: 'task:completed'; taskId: string; title: string }
  | { type: 'task:rescheduled'; taskId: string; title: string; newDate: string }
  | { type: 'gamification:level-up'; newLevel: number; xp: number }
  | { type: 'gamification:achievement-unlocked'; achievementId: string; name: string }
  | { type: 'gamification:streak-milestone'; days: number; vibe: string };

export interface NotificationPayload {
  id: string;
  event: NotificationEvent;
  timestamp: number;
  dismissedAt?: number;
}

export function getNotificationMessage(event: NotificationEvent): { icon: string; text: string } {
  switch (event.type) {
    case 'task:overdue':
      return { icon: '⚠️', text: `Quest overdue: ${event.title}` };
    case 'task:due-soon':
      return { icon: '⏰', text: `Quest due soon: ${event.title}` };
    case 'task:completed':
      return { icon: '✓', text: `Quest completed: ${event.title}` };
    case 'task:rescheduled':
      return { icon: '📅', text: `Rescheduled to ${event.newDate}` };
    case 'gamification:level-up':
      return { icon: '📈', text: `Level up to ${event.newLevel}!` };
    case 'gamification:achievement-unlocked':
      return { icon: '⭐', text: `Achievement unlocked: ${event.name}` };
    case 'gamification:streak-milestone':
      return { icon: '🔥', text: `${event.days}-day streak! (${event.vibe})` };
  }
}

export function shouldPlaySound(event: NotificationEvent): boolean {
  return event.type === 'gamification:level-up'
    || event.type === 'gamification:achievement-unlocked'
    || event.type === 'gamification:streak-milestone';
}
