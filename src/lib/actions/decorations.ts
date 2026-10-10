"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DECORATIONS_CATALOG, DEFAULT_DECORATION_POSITIONS } from "@/lib/decorations-catalog";
import { PRIORITY_COIN_BONUS } from "@/lib/gamification";
import type { Priority } from "@/types/task";
import type { ActionResult } from "@/lib/actions/types";
import { broadcastSyncEvent } from "@/lib/sync-events";

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

    // Calculate user's total coins (task coins + bonusCoins) using Postgres groupBy aggregation
    const grouped = await db.task.groupBy({
      by: ["priority"],
      where: { ownerId: user.id, status: "done", deletedAt: null },
      _count: { id: true },
    });

    const taskCoins = grouped.reduce(
      (sum, g) =>
        sum +
        g._count.id * (PRIORITY_COIN_BONUS[g.priority as Priority] ?? 0),
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
      select: { id: true },
    });

    broadcastSyncEvent(user.id, "sync:reload", { purchasedDecorations: newPurchased, bonusCoins: newBonusCoins });

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

export async function moveDecoration(
  category: "desk" | "chair" | "decor" | "wallpaper" | "floor",
  x: number,
  y: number
): Promise<ActionResult<{ placedDecorations: Record<string, any> }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, placedDecorations: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentPlaced = (user.placedDecorations as Record<string, any>) || {};
    const currentItem = currentPlaced[category];

    if (!currentItem) {
      return { success: false, error: { code: "NOT_FOUND", message: "No item placed in this category." } };
    }

    // Handle both old format (string) and new format (object with id/x/y)
    const itemId = typeof currentItem === "string" ? currentItem : currentItem.id;
    if (!itemId) {
      return { success: false, error: { code: "NOT_FOUND", message: "Invalid item data." } };
    }

    const newPlaced = {
      ...currentPlaced,
      [category]: { id: itemId, x, y },
    };

    await db.user.update({
      where: { id: user.id },
      data: {
        placedDecorations: newPlaced,
      },
      select: { id: true },
    });

    broadcastSyncEvent(user.id, "sync:reload", { placedDecorations: newPlaced });

    return {
      success: true,
      data: {
        placedDecorations: newPlaced,
      },
    };
  } catch (error) {
    console.error("Failed to move decoration:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to move decoration." } };
  }
}

export async function placeDecoration(
  category: "desk" | "chair" | "decor" | "wallpaper" | "floor",
  itemId: string | null
): Promise<ActionResult<{ placedDecorations: Record<string, any> }>> {
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

    const currentPlaced = (user.placedDecorations as Record<string, any>) || {};
    const prevItem = currentPlaced[category];
    const prevPos = prevItem && typeof prevItem === "object"
      ? { x: prevItem.x ?? DEFAULT_DECORATION_POSITIONS[category]?.x ?? 50, y: prevItem.y ?? DEFAULT_DECORATION_POSITIONS[category]?.y ?? 12 }
      : (DEFAULT_DECORATION_POSITIONS[category] ?? { x: 50, y: 12 });

    const newPlaced = {
      ...currentPlaced,
      [category]: itemId ? { id: itemId, ...prevPos } : null,
    };

    await db.user.update({
      where: { id: user.id },
      data: {
        placedDecorations: newPlaced,
      },
      select: { id: true },
    });

    broadcastSyncEvent(user.id, "sync:reload", { placedDecorations: newPlaced });

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

export async function resetDecorationPositions(): Promise<ActionResult<{ placedDecorations: Record<string, any> }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, placedDecorations: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentPlaced = (user.placedDecorations as Record<string, any>) || {};
    const newPlaced: Record<string, any> = { ...currentPlaced };

    for (const [cat, defPos] of Object.entries(DEFAULT_DECORATION_POSITIONS)) {
      if (newPlaced[cat]) {
        const id = typeof newPlaced[cat] === "string" ? newPlaced[cat] : newPlaced[cat].id;
        newPlaced[cat] = { id, ...defPos };
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: { placedDecorations: newPlaced },
      select: { id: true },
    });

    broadcastSyncEvent(user.id, "sync:reload", { placedDecorations: newPlaced });

    return { success: true, data: { placedDecorations: newPlaced } };
  } catch (error) {
    console.error("Failed to reset decoration positions:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to reset positions." } };
  }
}
