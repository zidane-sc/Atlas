-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reduce_motion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sound_enabled" BOOLEAN NOT NULL DEFAULT true;
