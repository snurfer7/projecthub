-- AlterTable
ALTER TABLE "groups" ADD COLUMN "permission_set_id" INTEGER;

-- CreateTable
CREATE TABLE "permission_resources" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL DEFAULT 'feature',
    "parent_id" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permission_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_sets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_set_permissions" (
    "id" SERIAL NOT NULL,
    "permission_set_id" INTEGER NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "can_use" BOOLEAN NOT NULL DEFAULT false,
    "can_input" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permission_set_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_resources_code_key" ON "permission_resources"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_sets_name_key" ON "permission_sets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permission_set_permissions_permission_set_id_resource_id_key" ON "permission_set_permissions"("permission_set_id", "resource_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_resources" ADD CONSTRAINT "permission_resources_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "permission_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_permissions" ADD CONSTRAINT "permission_set_permissions_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_permissions" ADD CONSTRAINT "permission_set_permissions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "permission_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
