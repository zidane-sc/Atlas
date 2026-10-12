"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatePat } from "@/lib/services/credentials-service";
import type { ActionResult } from "@/lib/actions/types";

export interface CredentialSummary {
  id: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export async function listCredentialsAction(): Promise<ActionResult<CredentialSummary[]>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };

    const creds = await db.integrationCredential.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        tokenPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: creds.map((c) => ({
        ...c,
        lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    console.error("listCredentialsAction error:", err);
    return { success: true, data: [] };
  }
}

export async function createCredentialAction(
  label: string = "Hermes Agent",
  scopes: string[] = ["all"],
  expiresInDays?: number | null
): Promise<ActionResult<{ credential: CredentialSummary; plainToken: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };

  const { token, prefix, hash } = generatePat(label);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const created = await db.integrationCredential.create({
    data: {
      userId: user.id,
      label: label.trim() || "Hermes Agent",
      tokenPrefix: prefix,
      tokenHash: hash,
      scopes: scopes && scopes.length > 0 ? scopes : ["all"],
      expiresAt,
    },
  });

  return {
    success: true,
    data: {
      credential: {
        id: created.id,
        label: created.label,
        tokenPrefix: created.tokenPrefix,
        scopes: created.scopes,
        lastUsedAt: null,
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      },
      plainToken: token,
    },
  };
}

export async function revokeCredentialAction(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };

  await db.integrationCredential.updateMany({
    where: { id, userId: user.id },
    data: { revokedAt: new Date() },
  });

  return { success: true, data: { id } };
}
