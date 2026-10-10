import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribeToSyncEvents, type SyncEvent } from "@/lib/sync-events";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max streaming window on Vercel Serverless; EventSource auto-reconnects seamlessly

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

  // Read Last-Event-ID header or query param for lossless reconnects
  const url = new URL(req.url);
  const lastEventId = req.headers.get("last-event-id") || url.searchParams.get("lastEventId");
  let lastEventTime = new Date(Date.now() - 3000); // 3s grace window

  if (lastEventId) {
    try {
      const lastEvent = await db.syncEvent.findUnique({
        where: { id: lastEventId },
        select: { createdAt: true },
      });
      if (lastEvent) {
        lastEventTime = lastEvent.createdAt;
      }
    } catch {}
  }

  let unsubscribeLocal: (() => void) | null = null;
  let pollInterval: NodeJS.Timeout | null = null;
  const seenIds = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Initial connected event
      controller.enqueue(
        encoder.encode(`event: init\ndata: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`)
      );

      // 2. In-process listener (0ms latency for connections on this worker)
      unsubscribeLocal = subscribeToSyncEvents(userId, (event: SyncEvent) => {
        try {
          if (event.id) seenIds.add(event.id);
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`${event.id ? `id: ${event.id}\n` : ""}data: ${payload}\n\n`));
        } catch {
          // Client closed
        }
      });

      // 3. Periodic polling loop against Postgres event bus (guarantees cross-device / multi-container sync)
      let pingTicks = 0;
      pollInterval = setInterval(async () => {
        try {
          const events = await db.syncEvent.findMany({
            where: {
              userId,
              createdAt: { gt: lastEventTime },
            },
            orderBy: { createdAt: "asc" },
            take: 20,
          });

          if (events.length > 0) {
            for (const ev of events) {
              if (seenIds.has(ev.id)) continue;
              seenIds.add(ev.id);
              if (seenIds.size > 200) {
                const first = seenIds.values().next().value;
                if (first) seenIds.delete(first);
              }
              lastEventTime = ev.createdAt;
              const payload = JSON.stringify({
                type: ev.type,
                data: ev.data,
                timestamp: ev.createdAt.getTime(),
              });
              controller.enqueue(encoder.encode(`id: ${ev.id}\ndata: ${payload}\n\n`));
            }
          }

          // Heartbeat ping every ~15 seconds (10 ticks * 1.5s)
          pingTicks++;
          if (pingTicks >= 10) {
            controller.enqueue(encoder.encode(`: ping\n\n`));
            pingTicks = 0;
          }
        } catch {
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 1500);
    },
    cancel() {
      if (unsubscribeLocal) unsubscribeLocal();
      if (pollInterval) clearInterval(pollInterval);
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
