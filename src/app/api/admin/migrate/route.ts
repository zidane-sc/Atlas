import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const passcode = url.searchParams.get("passcode") || req.headers.get("x-passcode");
  const expectedPasscode = process.env.ATLAS_PASSCODE || "atlas123";

  if (passcode !== expectedPasscode) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];

  try {
    // 1. Check existing migrations
    const appliedRows: any[] = await db.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations ORDER BY started_at ASC`
    );
    const appliedNames = new Set(appliedRows.map((r) => r.migration_name));
    logs.push(`Currently applied: ${Array.from(appliedNames).join(", ")}`);

    // 2. Migration 1: 20261010000000_align_schema (Ensure tables exist regardless of _prisma_migrations record)
    logs.push("Ensuring align_schema tables exist...");
    await db.$executeRawUnsafe(`
        DO $$ BEGIN CREATE TYPE "attachment_type" AS ENUM ('github_pr', 'github_issue', 'confluence', 'figma', 'slack', 'discord', 'google_docs', 'google_drive', 'meeting_recording', 'website', 'file_upload', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "deliverable_type" AS ENUM ('pr', 'confluence', 'presentation', 'meeting_notes', 'design', 'video', 'pdf', 'research'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "task_relation_type" AS ENUM ('blocks', 'related', 'duplicate', 'caused_by', 'generated_from'); EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE TYPE "achievement_category" AS ENUM ('combat', 'exploration', 'crafting', 'social'); EXCEPTION WHEN duplicate_object THEN null; END $$;

        CREATE TABLE IF NOT EXISTS "settings" (
            "id" UUID NOT NULL,
            "user_id" UUID NOT NULL,
            "key" TEXT NOT NULL,
            "value" JSONB NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "tags" (
            "id" UUID NOT NULL,
            "name" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "task_tags" (
            "task_id" UUID NOT NULL,
            "tag_id" UUID NOT NULL,
            CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id", "tag_id")
        );

        CREATE TABLE IF NOT EXISTS "attachments" (
            "id" UUID NOT NULL,
            "task_id" UUID NOT NULL,
            "type" "attachment_type" NOT NULL,
            "url" TEXT NOT NULL,
            "label" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "deliverables" (
            "id" UUID NOT NULL,
            "task_id" UUID NOT NULL,
            "type" "deliverable_type" NOT NULL,
            "url_or_content" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "task_relations" (
            "id" UUID NOT NULL,
            "task_id" UUID NOT NULL,
            "related_task_id" UUID NOT NULL,
            "relation_type" "task_relation_type" NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "xp_logs" (
            "id" UUID NOT NULL,
            "task_id" UUID,
            "user_id" UUID NOT NULL,
            "amount" INTEGER NOT NULL,
            "reason" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "xp_logs_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "achievements" (
            "id" UUID NOT NULL,
            "key" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "icon" TEXT NOT NULL,
            "category" "achievement_category" NOT NULL,
            "unlocked_at" TIMESTAMP(3),
            CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
        );

        DO $$ BEGIN CREATE UNIQUE INDEX "settings_user_id_key_key" ON "settings"("user_id", "key"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE INDEX "deliverables_task_id_idx" ON "deliverables"("task_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE INDEX "task_relations_related_task_id_idx" ON "task_relations"("related_task_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE UNIQUE INDEX "task_relations_task_id_related_task_id_relation_type_key" ON "task_relations"("task_id", "related_task_id", "relation_type"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE INDEX "xp_logs_user_id_idx" ON "xp_logs"("user_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE INDEX "xp_logs_task_id_idx" ON "xp_logs"("task_id"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;
        DO $$ BEGIN CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN null; END $$;

        DO $$ BEGIN ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_related_task_id_fkey" FOREIGN KEY ("related_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "xp_logs" ADD CONSTRAINT "xp_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN ALTER TABLE "xp_logs" ADD CONSTRAINT "xp_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    logs.push("Ensured align_schema tables exist ✅");

    // 3. Migration 2: 20261011000000_simplify_schema
    if (!appliedNames.has("20261011000000_simplify_schema")) {
      logs.push("Applying 20261011000000_simplify_schema...");
      await db.$executeRawUnsafe(`
        ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_sprint_id_fkey";
        DROP TABLE IF EXISTS "sprints" CASCADE;
        DROP TABLE IF EXISTS "_ProjectToSprint" CASCADE;
        ALTER TABLE "tasks" DROP COLUMN IF EXISTS "sprint_id";

        -- project_category enum
        DO $$ BEGIN
          ALTER TABLE "projects" ALTER COLUMN "category" DROP DEFAULT;
          ALTER TABLE "projects" ALTER COLUMN "category" TYPE TEXT;
          DROP TYPE IF EXISTS "project_category";
          CREATE TYPE "project_category" AS ENUM ('work', 'personal', 'learning', 'other');
          ALTER TABLE "projects" ALTER COLUMN "category" TYPE "project_category" USING 
            CASE 
              WHEN "category" IN ('Full-time', 'FullTime', 'Freelance') THEN 'work'::"project_category"
              WHEN "category" = 'University' THEN 'learning'::"project_category"
              WHEN "category" IN ('Side Project', 'SideProject', 'Personal') THEN 'personal'::"project_category"
              ELSE 'other'::"project_category"
            END;
          ALTER TABLE "projects" ALTER COLUMN "category" SET DEFAULT 'other';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- project_status enum
        DO $$ BEGIN
          ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;
          ALTER TABLE "projects" ALTER COLUMN "status" TYPE TEXT;
          DROP TYPE IF EXISTS "project_status";
          CREATE TYPE "project_status" AS ENUM ('active', 'completed', 'archived');
          ALTER TABLE "projects" ALTER COLUMN "status" TYPE "project_status" USING 
            CASE 
              WHEN "status" = 'on_hold' THEN 'archived'::"project_status"
              WHEN "status" IN ('active', 'completed', 'archived') THEN "status"::"project_status"
              ELSE 'active'::"project_status"
            END;
          ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_priority enum
        DO $$ BEGIN
          ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT;
          ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE TEXT;
          DROP TYPE IF EXISTS "task_priority";
          CREATE TYPE "task_priority" AS ENUM ('high', 'medium', 'low');
          ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "task_priority" USING 
            CASE 
              WHEN "priority" IN ('p0', 'p1') THEN 'high'::"task_priority"
              WHEN "priority" = 'p2' THEN 'medium'::"task_priority"
              WHEN "priority" IN ('p3', 'p4') THEN 'low'::"task_priority"
              WHEN "priority" IN ('high', 'medium', 'low') THEN "priority"::"task_priority"
              ELSE 'medium'::"task_priority"
            END;
          ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'medium';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_status enum
        DO $$ BEGIN
          ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
          ALTER TABLE "tasks" ALTER COLUMN "status" TYPE TEXT;
          ALTER TABLE "task_status_logs" ALTER COLUMN "from_status" TYPE TEXT;
          ALTER TABLE "task_status_logs" ALTER COLUMN "to_status" TYPE TEXT;
          DROP TYPE IF EXISTS "task_status";
          CREATE TYPE "task_status" AS ENUM ('backlog', 'todo', 'in_progress', 'done', 'archived');
          ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "task_status" USING 
            CASE 
              WHEN "status" = 'inbox' THEN 'backlog'::"task_status"
              WHEN "status" = 'ready' THEN 'todo'::"task_status"
              WHEN "status" IN ('blocked', 'waiting_external', 'testing') THEN 'in_progress'::"task_status"
              WHEN "status" IN ('backlog', 'todo', 'in_progress', 'done', 'archived') THEN "status"::"task_status"
              ELSE 'todo'::"task_status"
            END;
          ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'todo';

          ALTER TABLE "task_status_logs" ALTER COLUMN "from_status" TYPE "task_status" USING 
            CASE 
              WHEN "from_status" = 'inbox' THEN 'backlog'::"task_status"
              WHEN "from_status" = 'ready' THEN 'todo'::"task_status"
              WHEN "from_status" IN ('blocked', 'waiting_external', 'testing') THEN 'in_progress'::"task_status"
              WHEN "from_status" IN ('backlog', 'todo', 'in_progress', 'done', 'archived') THEN "from_status"::"task_status"
              ELSE NULL
            END;

          ALTER TABLE "task_status_logs" ALTER COLUMN "to_status" TYPE "task_status" USING 
            CASE 
              WHEN "to_status" = 'inbox' THEN 'backlog'::"task_status"
              WHEN "to_status" = 'ready' THEN 'todo'::"task_status"
              WHEN "to_status" IN ('blocked', 'waiting_external', 'testing') THEN 'in_progress'::"task_status"
              WHEN "to_status" IN ('backlog', 'todo', 'in_progress', 'done', 'archived') THEN "to_status"::"task_status"
              ELSE 'todo'::"task_status"
            END;
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_type enum
        DO $$ BEGIN
          ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT;
          ALTER TABLE "tasks" ALTER COLUMN "type" TYPE TEXT;
          DROP TYPE IF EXISTS "task_type";
          CREATE TYPE "task_type" AS ENUM ('coding', 'research', 'design', 'documentation', 'bug', 'meeting', 'admin');
          ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "task_type" USING 
            CASE 
              WHEN "type" IN ('investigation', 'study', 'analysis') THEN 'research'::"task_type"
              WHEN "type" IN ('deployment', 'testing', 'maintenance') THEN 'admin'::"task_type"
              WHEN "type" = 'refactor' THEN 'coding'::"task_type"
              WHEN "type" = 'incident' THEN 'bug'::"task_type"
              WHEN "type" = 'communication' THEN 'meeting'::"task_type"
              WHEN "type" IN ('coding', 'research', 'design', 'documentation', 'bug', 'meeting', 'admin') THEN "type"::"task_type"
              ELSE 'coding'::"task_type"
            END;
          ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'coding';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_relation_type enum
        DO $$ BEGIN
          ALTER TABLE "task_relations" ALTER COLUMN "relation_type" TYPE TEXT;
          DROP TYPE IF EXISTS "task_relation_type";
          CREATE TYPE "task_relation_type" AS ENUM ('blocks', 'relates_to', 'duplicates');
          ALTER TABLE "task_relations" ALTER COLUMN "relation_type" TYPE "task_relation_type" USING 
            CASE 
              WHEN "relation_type" = 'related' THEN 'relates_to'::"task_relation_type"
              WHEN "relation_type" = 'duplicate' THEN 'duplicates'::"task_relation_type"
              WHEN "relation_type" IN ('caused_by', 'generated_from') THEN 'relates_to'::"task_relation_type"
              WHEN "relation_type" IN ('blocks', 'relates_to', 'duplicates') THEN "relation_type"::"task_relation_type"
              ELSE 'relates_to'::"task_relation_type"
            END;
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_reporter enum
        DO $$ BEGIN
          ALTER TABLE "tasks" ALTER COLUMN "reporter" DROP DEFAULT;
          ALTER TABLE "tasks" ALTER COLUMN "reporter" TYPE TEXT;
          DROP TYPE IF EXISTS "task_reporter";
          CREATE TYPE "task_reporter" AS ENUM ('self', 'other');
          ALTER TABLE "tasks" ALTER COLUMN "reporter" TYPE "task_reporter" USING 
            CASE 
              WHEN "reporter" IN ('qa', 'manager', 'pm', 'client', 'lecturer', 'friend', 'other') THEN 'other'::"task_reporter"
              ELSE 'self'::"task_reporter"
            END;
          ALTER TABLE "tasks" ALTER COLUMN "reporter" SET DEFAULT 'self';
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- attachment_type enum
        DO $$ BEGIN
          ALTER TABLE "attachments" ALTER COLUMN "type" TYPE TEXT;
          DROP TYPE IF EXISTS "attachment_type";
          CREATE TYPE "attachment_type" AS ENUM ('github_pr', 'github_issue', 'link', 'file', 'other');
          ALTER TABLE "attachments" ALTER COLUMN "type" TYPE "attachment_type" USING 
            CASE 
              WHEN "type" IN ('confluence', 'figma', 'slack', 'discord', 'google_docs', 'google_drive', 'website') THEN 'link'::"attachment_type"
              WHEN "type" IN ('meeting_recording', 'file_upload') THEN 'file'::"attachment_type"
              WHEN "type" IN ('github_pr', 'github_issue', 'link', 'file', 'other') THEN "type"::"attachment_type"
              ELSE 'other'::"attachment_type"
            END;
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- deliverable_type enum
        DO $$ BEGIN
          ALTER TABLE "deliverables" ALTER COLUMN "type" TYPE TEXT;
          DROP TYPE IF EXISTS "deliverable_type";
          CREATE TYPE "deliverable_type" AS ENUM ('pr', 'doc', 'design', 'other');
          ALTER TABLE "deliverables" ALTER COLUMN "type" TYPE "deliverable_type" USING 
            CASE 
              WHEN "type" IN ('confluence', 'presentation', 'meeting_notes', 'pdf', 'research') THEN 'doc'::"deliverable_type"
              WHEN "type" = 'video' THEN 'design'::"deliverable_type"
              WHEN "type" IN ('pr', 'doc', 'design', 'other') THEN "type"::"deliverable_type"
              ELSE 'other'::"deliverable_type"
            END;
        EXCEPTION WHEN OTHERS THEN null;
        END $$;

        -- task_size enum and column
        DO $$ BEGIN
          CREATE TYPE "task_size" AS ENUM ('xs', 's', 'm', 'l', 'xl');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "size" "task_size" DEFAULT 'm';
        ALTER TABLE "tasks" DROP COLUMN IF EXISTS "effort";
        ALTER TABLE "tasks" DROP COLUMN IF EXISTS "story_point";
        ALTER TABLE "tasks" DROP COLUMN IF EXISTS "parent_id";
        ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parent_id_fkey";
        ALTER TABLE "tasks" DROP COLUMN IF EXISTS "note_links";

        DROP TABLE IF EXISTS "note_task_links" CASCADE;
        DROP TABLE IF EXISTS "note_attachments" CASCADE;
        DROP TABLE IF EXISTS "notes" CASCADE;

        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (gen_random_uuid(), '7b14d01e13efd109549138ee4a056129e894335bc4ca319381f664cf4c827b9f', NOW(), '20261011000000_simplify_schema', NULL, NULL, NOW(), 1)
        ON CONFLICT (id) DO NOTHING;
      `);
      logs.push("Applied 20261011000000_simplify_schema ✅");
    }

    // 4. Verification check
    const taskCols: any[] = await db.$queryRawUnsafe(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name IN ('size', 'effort', 'story_point', 'sprint_id');
    `);

    return NextResponse.json({
      success: true,
      message: "Database schema migration completed successfully",
      logs,
      taskColumns: taskCols,
    });
  } catch (err: any) {
    console.error("Migration endpoint error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || String(err),
        stack: err?.stack,
        logs,
      },
      { status: 500 }
    );
  }
}
