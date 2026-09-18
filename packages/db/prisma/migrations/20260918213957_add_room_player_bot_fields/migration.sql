-- AlterTable
ALTER TABLE "RoomPlayer" ADD COLUMN     "botDifficulty" TEXT,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;
