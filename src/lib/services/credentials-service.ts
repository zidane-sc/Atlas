import { db } from "@/lib/db";
import crypto from "node:crypto";

export interface ResolvedCredential {
  userId: string;
  credentialId: string;
  label: string;
  scopes: string[];
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function generatePat(label: string = "Hermes Agent"): { token: string; prefix: string; hash: string } {
  const rawBytes = crypto.randomBytes(24).toString("hex");
  const token = `atl_live_${rawBytes}`;
  const prefix = token.slice(0, 14);
  const hash = hashToken(token);
  return { token, prefix, hash };
}

export async function verifyBearerToken(authHeader: string | null): Promise<ResolvedCredential | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const cred = await db.integrationCredential.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true } } },
  });

  if (!cred) return null;
  if (cred.revokedAt) return null;
  if (cred.expiresAt && cred.expiresAt < new Date()) return null;

  // Touch last_used_at fire-and-forget
  db.integrationCredential
    .update({
      where: { id: cred.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    userId: cred.userId,
    credentialId: cred.id,
    label: cred.label,
    scopes: cred.scopes,
  };
}
