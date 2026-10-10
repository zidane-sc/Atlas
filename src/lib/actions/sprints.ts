"use server";

import type { ActionResult } from "@/lib/actions/types";
import type { Sprint } from "@/types/gamification";

export async function createSprint(_input: unknown): Promise<ActionResult<Sprint>> {
  return { success: false, error: { code: "NOT_FOUND", message: "Sprints have been removed." } };
}

export async function updateSprint(_id: string, _input: unknown): Promise<ActionResult<Sprint>> {
  return { success: false, error: { code: "NOT_FOUND", message: "Sprints have been removed." } };
}

export async function deleteSprint(_id: string): Promise<ActionResult<void>> {
  return { success: false, error: { code: "NOT_FOUND", message: "Sprints have been removed." } };
}
