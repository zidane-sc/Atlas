"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DECORATIONS_CATALOG } from "@/lib/decorations-catalog";
import { PRIORITY_COIN_BONUS } from "@/lib/gamification";
import type { Priority } from "@/types/task";
import type { ActionResult } from "@/lib/actions/types";

export async function purchaseDecoration(itemId: string): Promise<ActionResult<{ bonusCoins: number; purchasedDecorations: string[] }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const item = DECORATIONS_CATALOG.find((d) => d.id === itemId);
  if (!item) {
    return { success: false, error: { code: "NOT_FOUND", message: "Item not found in catalog." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, bonusCoins: true, purchasedDecorations: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    if (user.purchasedDecorations.includes(itemId)) {
      return { success: false, error: { code: "CONFLICT", message: "You already own this item." } };
    }

    // Calculate user's total coins (task coins + bonusCoins)
    const doneTasks = await db.task.findMany({
      where: { ownerId: user.id, status: "done", deletedAt: null },
      select: { storyPoint: true, priority: true },
    });

    const taskCoins = doneTasks.reduce(
      (sum, t) => sum + (t.storyPoint ?? 0) + PRIORITY_COIN_BONUS[t.priority as Priority],
      0
    );
    const totalCoins = taskCoins + user.bonusCoins;

    if (totalCoins < item.cost) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Not enough coins." } };
    }

    // Deduct cost and add to purchased list
    const newBonusCoins = user.bonusCoins - item.cost;
    const newPurchased = [...user.purchasedDecorations, itemId];

    await db.user.update({
      where: { id: user.id },
      data: {
        bonusCoins: newBonusCoins,
        purchasedDecorations: newPurchased,
      },
    });

    return {
      success: true,
      data: {
        bonusCoins: newBonusCoins,
        purchasedDecorations: newPurchased,
      },
    };
  } catch (error) {
    console.error("Failed to purchase decoration:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to purchase decoration." } };
  }
}

export async function placeDecoration(
  category: "desk" | "chair" | "decor" | "wallpaper" | "floor",
  itemId: string | null
): Promise<ActionResult<{ placedDecorations: Record<string, string | null> }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  // Validate item exists and belongs to correct category
  if (itemId !== null) {
    const item = DECORATIONS_CATALOG.find((d) => d.id === itemId);
    if (!item) {
      return { success: false, error: { code: "NOT_FOUND", message: "Item not found in catalog." } };
    }
    if (item.category !== category) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Item does not belong to this category." } };
    }
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, purchasedDecorations: true, placedDecorations: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    // Validate ownership
    if (itemId !== null) {
      const item = DECORATIONS_CATALOG.find((d) => d.id === itemId);
      if (item && item.cost > 0 && !user.purchasedDecorations.includes(itemId)) {
        return { success: false, error: { code: "UNAUTHORIZED", message: "You do not own this item." } };
      }
    }

    const currentPlaced = (user.placedDecorations as Record<string, string | null>) || {};
    const newPlaced = {
      ...currentPlaced,
      [category]: itemId,
    };

    await db.user.update({
      where: { id: user.id },
      data: {
        placedDecorations: newPlaced,
      },
    });

    return {
      success: true,
      data: {
        placedDecorations: newPlaced,
      },
    };
  } catch (error) {
    console.error("Failed to place decoration:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to place decoration." } };
  }
}
