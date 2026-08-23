-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "useJokers" BOOLEAN NOT NULL DEFAULT false;
