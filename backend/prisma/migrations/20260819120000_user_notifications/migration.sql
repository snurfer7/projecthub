-- AlterTable
ALTER TABLE "users" ADD COLUMN "notification_channel" TEXT NOT NULL DEFAULT 'email';

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN "default_notification_channel" TEXT NOT NULL DEFAULT 'email';

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_event_type_key" ON "user_notification_preferences"("user_id", "event_type");

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
