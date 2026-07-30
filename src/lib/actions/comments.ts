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

  const owner = await db.user.findFirst({ where: { email: session.user.email } });
  if (!owner) {
    return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
  }

  try {
    const comment = await db.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId: parsed.data.taskId,
          content: parsed.data.content,
          authorId: owner.id,
        },
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
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to post comment." } };
  }
}
