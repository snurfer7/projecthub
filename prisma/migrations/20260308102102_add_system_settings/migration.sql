-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '18:00',
    "managementTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
