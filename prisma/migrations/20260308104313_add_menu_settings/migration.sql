-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "show_admin_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_company_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_gantt_menu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_projects_menu" BOOLEAN NOT NULL DEFAULT true;
