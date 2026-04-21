-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN "email_transport" TEXT NOT NULL DEFAULT 'ses',
ADD COLUMN "email_from_override" TEXT,
ADD COLUMN "smtp_host" TEXT,
ADD COLUMN "smtp_port" INTEGER NOT NULL DEFAULT 587,
ADD COLUMN "smtp_user" TEXT,
ADD COLUMN "smtp_password_enc" TEXT,
ADD COLUMN "smtp_secure" BOOLEAN NOT NULL DEFAULT false;
