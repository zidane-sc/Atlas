"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function togglePin(taskId: string, pinned: boolean) {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.task.update({
      where: { id: taskId },
      data: { pinned },
    });

    return { success: true };
  } catch (error) {
    console.error("Pin toggle error:", error);
    return { success: false, error: "Failed to toggle pin" };
  }
}
