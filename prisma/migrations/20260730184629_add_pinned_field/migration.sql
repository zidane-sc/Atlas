/*
  Warnings:

  - You are about to drop the column `reduce_motion` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `sound_enabled` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "reduce_motion",
DROP COLUMN "sound_enabled",
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '[{"key":"notifications","label":"Notifications","description":"Overdue and sprint deadline alerts","type":"boolean","value":true},{"key":"soundEnabled","label":"Sound Effects","description":"Subtle chimes on task complete and level-up","type":"boolean","value":true},{"key":"reduceMotion","label":"Reduce Motion","description":"Shortens all animation durations","type":"boolean","value":false},{"key":"defaultView","label":"Default View","description":"Screen shown on app open","type":"select","options":["dashboard","today","focus","kanban"],"value":"dashboard"}]';
