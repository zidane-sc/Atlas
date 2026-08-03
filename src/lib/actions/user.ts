"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import type { UserSetting } from "@/types/settings";
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
const updateStatsSchema = z.object({
  bonusXp: z.number().int().min(0),
  bonusCoins: z.number().int().min(0),
});

export async function updateUserStats(input: unknown): Promise<ActionResult<{ bonusXp: number; bonusCoins: number } & Partial<CharacterSheetData>>> {
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
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        bonusXp: parsed.data.bonusXp,
        bonusCoins: parsed.data.bonusCoins,
      },
    });

    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(user.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after updating user stats:", sheetErr);
    }

    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
        ...sheetData,
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
    const exists = currentSettings.some((s) => s.key === key);
    const updatedSettings = exists
      ? currentSettings.map((s) => (s.key === key ? { ...s, value } : s))
      : [...currentSettings, { key, label: key, description: "", type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string", value } as UserSetting];

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
  ActionResult<
    {
      bonusXp: number;
      bonusCoins: number;
      lastQuestClaimedAt: string | null;
    } & Partial<CharacterSheetData>
  >
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

    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(user.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after daily quest claim:", sheetErr);
    }

    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
        lastQuestClaimedAt: updated.lastQuestClaimedAt ? updated.lastQuestClaimedAt.toISOString() : null,
        ...sheetData,
      },
    };
  } catch (error) {
    console.error("Failed to claim daily quest:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to claim daily quest." } };
  }
}

const updateDrawerLastSelectedSchema = z.object({
  pickerType: z.enum(["task", "sprint", "project"]),
  itemId: z.string().uuid(),
});

export async function updateDrawerLastSelectedAction(
  pickerType: "task" | "sprint" | "project",
  itemId: string
): Promise<ActionResult<{ drawerLastSelected: Record<string, string | null> }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateDrawerLastSelectedSchema.safeParse({ pickerType, itemId });
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
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
    const drawerSetting = currentSettings.find((s) => s.key === "drawerLastSelected");
    let drawerLastSelected = (drawerSetting?.value as Record<string, string | null>) || { task: null, sprint: null, project: null };
    drawerLastSelected[pickerType] = itemId;

    const updatedSettings = currentSettings
      .filter((s) => s.key !== "drawerLastSelected")
      .concat([
        {
          key: "drawerLastSelected",
          label: "Drawer Last Selected",
          type: "json",
          value: drawerLastSelected,
        } as unknown as UserSetting,
      ]);

    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        settings: updatedSettings as unknown as Prisma.InputJsonValue,
      },
      select: { settings: true },
    });

    return {
      success: true,
      data: {
        drawerLastSelected: drawerLastSelected,
      },
    };
  } catch (error) {
    console.error("Failed to update drawer last selected:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update drawer selection." } };
  }
}

const updateUserProfileSchema = z.object({
  name: z.string().min(1, "Name required").max(50, "Name too long"),
});

export async function updateUserProfileAction(
  name: string
): Promise<ActionResult<{ name: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateUserProfileSchema.safeParse({ name });
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
        name: parsed.data.name,
      },
      select: { name: true },
    });

    return {
      success: true,
      data: {
        name: updated.name,
      },
    };
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update profile." } };
  }
}
