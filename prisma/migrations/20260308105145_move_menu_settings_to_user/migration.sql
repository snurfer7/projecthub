/*
  Warnings:

  - You are about to drop the column `show_admin_menu` on the `system_settings` table. All the data in the column will be lost.
  - You are about to drop the column `show_company_menu` on the `system_settings` table. All the data in the column will be lost.
  - You are about to drop the column `show_gantt_menu` on the `system_settings` table. All the data in the column will be lost.
  - You are about to drop the column `show_projects_menu` on the `system_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "show_admin_menu",
DROP COLUMN "show_company_menu",
DROP COLUMN "show_gantt_menu",
DROP COLUMN "show_projects_menu";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "show_admin_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_company_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_gantt_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_projects_menu" BOOLEAN NOT NULL DEFAULT true;
