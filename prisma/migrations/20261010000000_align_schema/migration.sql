-- CreateEnum
CREATE TYPE "attachment_type" AS ENUM ('github_pr', 'github_issue', 'confluence', 'figma', 'slack', 'discord', 'google_docs', 'google_drive', 'meeting_recording', 'website', 'file_upload', 'other');
CREATE TYPE "deliverable_type" AS ENUM ('pr', 'confluence', 'presentation', 'meeting_notes', 'design', 'video', 'pdf', 'research');
CREATE TYPE "task_relation_type" AS ENUM ('blocks', 'related', 'duplicate', 'caused_by', 'generated_from');
CREATE TYPE "achievement_category" AS ENUM ('combat', 'exploration', 'crafting', 'social');

-- CreateTable: settings
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tags
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_tags
CREATE TABLE "task_tags" (
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id", "tag_id")
);

-- CreateTable: attachments
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "type" "attachment_type" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: deliverables
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "type" "deliverable_type" NOT NULL,
    "url_or_content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_relations
CREATE TABLE "task_relations" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "related_task_id" UUID NOT NULL,
    "relation_type" "task_relation_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: xp_logs
CREATE TABLE "xp_logs" (
    "id" UUID NOT NULL,
    "task_id" UUID,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "xp_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: achievements
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" "achievement_category" NOT NULL,
    "unlocked_at" TIMESTAMP(3),
    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- Add parent_id column back to tasks (was removed in 20260802023810)
ALTER TABLE "tasks" ADD COLUMN "parent_id" UUID;

-- Migrate tags from JSONB array to relational task_tags
-- First, extract unique tags from tasks.tags
DO $$
DECLARE
    task_record RECORD;
    tag_text TEXT;
    tag_id UUID;
BEGIN
    FOR task_record IN SELECT id, tags FROM tasks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 LOOP
        FOREACH tag_text IN ARRAY task_record.tags LOOP
            -- Upsert tag
            INSERT INTO tags (id, name, created_at)
            VALUES (gen_random_uuid(), tag_text, NOW())
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO tag_id;
            
            -- Link task to tag
            INSERT INTO task_tags (task_id, tag_id)
            VALUES (task_record.id, tag_id)
            ON CONFLICT (task_id, tag_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Migrate attachments from JSONB to attachments table
-- Expected JSON structure: [{"type": "...", "url": "...", "label": "..."}]
DO $$
DECLARE
    task_record RECORD;
    att_record JSONB;
    att_type TEXT;
    att_url TEXT;
    att_label TEXT;
BEGIN
    FOR task_record IN SELECT id, attachments FROM tasks WHERE attachments IS NOT NULL AND jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) > 0 LOOP
        FOR att_record IN SELECT * FROM jsonb_array_elements(task_record.attachments) LOOP
            att_type := att_record->>'type';
            att_url := att_record->>'url';
            att_label := att_record->>'label';
            
            IF att_type IS NOT NULL AND att_url IS NOT NULL THEN
                INSERT INTO attachments (id, task_id, type, url, label, created_at)
                VALUES (gen_random_uuid(), task_record.id, att_type::attachment_type, att_url, att_label, NOW());
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Migrate deliverables from JSONB to deliverables table
-- Expected JSON structure: [{"type": "...", "urlOrContent": "..."}]
DO $$
DECLARE
    task_record RECORD;
    del_record JSONB;
    del_type TEXT;
    del_content TEXT;
BEGIN
    FOR task_record IN SELECT id, deliverables FROM tasks WHERE deliverables IS NOT NULL AND jsonb_typeof(deliverables) = 'array' AND jsonb_array_length(deliverables) > 0 LOOP
        FOR del_record IN SELECT * FROM jsonb_array_elements(task_record.deliverables) LOOP
            del_type := del_record->>'type';
            del_content := del_record->>'urlOrContent';
            
            IF del_type IS NOT NULL AND del_content IS NOT NULL THEN
                INSERT INTO deliverables (id, task_id, type, url_or_content, created_at)
                VALUES (gen_random_uuid(), task_record.id, del_type::deliverable_type, del_content, NOW());
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Migrate relations from JSONB to task_relations table
-- Expected JSON structure: [{"taskId": "...", "relationType": "..."}]
DO $$
DECLARE
    task_record RECORD;
    rel_record JSONB;
    rel_task_id TEXT;
    rel_type TEXT;
BEGIN
    FOR task_record IN SELECT id, relations FROM tasks WHERE relations IS NOT NULL AND jsonb_typeof(relations) = 'array' AND jsonb_array_length(relations) > 0 LOOP
        FOR rel_record IN SELECT * FROM jsonb_array_elements(task_record.relations) LOOP
            rel_task_id := rel_record->>'taskId';
            rel_type := rel_record->>'relationType';
            
            IF rel_task_id IS NOT NULL AND rel_type IS NOT NULL THEN
                -- Validate relation type
                IF rel_type IN ('blocks', 'related', 'duplicate', 'caused_by', 'generated_from') THEN
                    INSERT INTO task_relations (id, task_id, related_task_id, relation_type, created_at)
                    VALUES (gen_random_uuid(), task_record.id, rel_task_id::UUID, rel_type::task_relation_type, NOW())
                    ON CONFLICT (task_id, related_task_id, relation_type) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Create indexes for new tables
CREATE UNIQUE INDEX "settings_user_id_key_key" ON "settings"("user_id", "key");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");
CREATE INDEX "deliverables_task_id_idx" ON "deliverables"("task_id");
CREATE INDEX "task_relations_related_task_id_idx" ON "task_relations"("related_task_id");
CREATE UNIQUE INDEX "task_relations_task_id_related_task_id_relation_type_key" ON "task_relations"("task_id", "related_task_id", "relation_type");
CREATE INDEX "xp_logs_user_id_idx" ON "xp_logs"("user_id");
CREATE INDEX "xp_logs_task_id_idx" ON "xp_logs"("task_id");
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");
CREATE INDEX "tasks_parent_id_idx" ON "tasks"("parent_id");

-- Add foreign keys
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_related_task_id_fkey" FOREIGN KEY ("related_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "xp_logs" ADD CONSTRAINT "xp_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "xp_logs" ADD CONSTRAINT "xp_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- _ProjectToSprint FKs already created by 20260805000000_sprint_project_many_to_many

-- Drop JSONB columns from tasks after data migration
-- Note: Keep them for now in case rollback is needed; can be dropped in a follow-up migration
-- ALTER TABLE "tasks" DROP COLUMN "tags";
-- ALTER TABLE "tasks" DROP COLUMN "relations";
-- ALTER TABLE "tasks" DROP COLUMN "attachments";
-- ALTER TABLE "tasks" DROP COLUMN "deliverables";