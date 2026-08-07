-- CreateTable
CREATE TABLE "group_hierarchies" (
    "id" SERIAL NOT NULL,
    "parent_group_id" INTEGER NOT NULL,
    "child_group_id" INTEGER NOT NULL,

    CONSTRAINT "group_hierarchies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_hierarchies_parent_group_id_child_group_id_key" ON "group_hierarchies"("parent_group_id", "child_group_id");

-- AddForeignKey
ALTER TABLE "group_hierarchies" ADD CONSTRAINT "group_hierarchies_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_hierarchies" ADD CONSTRAINT "group_hierarchies_child_group_id_fkey" FOREIGN KEY ("child_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
