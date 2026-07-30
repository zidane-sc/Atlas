"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";

const updateStatsSchema = z.object({
  bonusXp: z.number().int().min(0),
  bonusCoins: z.number().int().min(0),
});

export async function updateUserStats(input: unknown): Promise<ActionResult<{ bonusXp: number; bonusCoins: number }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateStatsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        bonusXp: parsed.data.bonusXp,
        bonusCoins: parsed.data.bonusCoins,
      },
    });

    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
      },
    };
  } catch {
    return { success: false, error: { code: "INTERNAL", message: "Failed to update user stats." } };
  }
}
