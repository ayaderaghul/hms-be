-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "tools" TEXT[],
    "howto" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
