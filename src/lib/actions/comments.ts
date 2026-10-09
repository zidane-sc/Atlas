"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/actions/activity";

const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().trim().min(1, "Comment content cannot be empty"),
});

export async function createComment(input: unknown): Promise<ActionResult<{ id: string; content: string; authorName: string; createdAt: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  const owner = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    const comment = await db.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: parsed.data.taskId, ownerId: owner.id, deletedAt: null },
        select: { id: true },
      });
      if (!task) {
        throw new Error("NOT_FOUND");
      }

      const created = await tx.comment.create({
        data: {
          taskId: parsed.data.taskId,
          content: parsed.data.content,
          authorId: owner.id,
        },
        select: { id: true, content: true, createdAt: true },
      });

      await logActivity(tx, owner.id, {
        taskId: parsed.data.taskId,
        action: "commented",
        details: { content: parsed.data.content },
      });

      return created;
    });

    return {
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        authorName: owner.name || owner.email,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: { code: "NOT_FOUND", message: "Task not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to post comment." } };
  }
}
