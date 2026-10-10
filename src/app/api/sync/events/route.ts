import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribeToSyncEvents, type SyncEvent } from "@/lib/sync-events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const userId = user.id;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      const initPayload = JSON.stringify({ type: "connected", timestamp: Date.now() });
      controller.enqueue(encoder.encode(`event: init\ndata: ${initPayload}\n\n`));

      // Subscribe to broadcaster
      unsubscribe = subscribeToSyncEvents(userId, (event: SyncEvent) => {
        try {
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Client probably disconnected
        }
      });

      // Keep-alive ping every 25 seconds
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 25000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
