import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${Date.now()}-${sanitizedName}`;

    // If Vercel Blob token is provided, upload to Blob storage
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        // @ts-expect-error Optional dependency for Vercel deployment
        const { put } = await import("@vercel/blob");
        const blob = await put(uniqueName, file, { access: "public" });
        return NextResponse.json({
          success: true,
          url: blob.url,
          filename: file.name,
          size: file.size,
          contentType: file.type,
        });
      } catch (blobErr) {
        console.warn("Vercel blob failed, falling back to local/data storage:", blobErr);
      }
    }

    // Local / Self-hosted storage fallback
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, uniqueName);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
