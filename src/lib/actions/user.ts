"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import type { UserSetting } from "@/types/settings";
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

export async function updateUserSettingAction(
  key: string,
  value: unknown
): Promise<ActionResult<UserSetting[]>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { settings: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentSettings = (user.settings || []) as unknown as UserSetting[];
    const updatedSettings = currentSettings.map((s) => {
      if (s.key === key) {
        return { ...s, value };
      }
      return s;
    });

    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        settings: updatedSettings as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: updated.settings as unknown as UserSetting[],
    };
  } catch (error) {
    console.error("Failed to update user setting:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update user setting." } };
  }
}

const claimQuestSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  xp: z.number().int().min(0),
  coins: z.number().int().min(0),
});

export async function claimDailyQuestAction(
  input: unknown
): Promise<
  ActionResult<{
    bonusXp: number;
    bonusCoins: number;
    lastQuestClaimedAt: string | null;
  }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = claimQuestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, bonusXp: true, bonusCoins: true, lastQuestClaimedAt: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    if (user.lastQuestClaimedAt && user.lastQuestClaimedAt.toISOString().slice(0, 10) === parsed.data.dateStr) {
      return { success: false, error: { code: "CONFLICT", message: "Daily quest already claimed for today." } };
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        bonusXp: user.bonusXp + parsed.data.xp,
        bonusCoins: user.bonusCoins + parsed.data.coins,
        lastQuestClaimedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
        lastQuestClaimedAt: updated.lastQuestClaimedAt ? updated.lastQuestClaimedAt.toISOString() : null,
      },
    };
  } catch (error) {
    console.error("Failed to claim daily quest:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to claim daily quest." } };
  }
}
