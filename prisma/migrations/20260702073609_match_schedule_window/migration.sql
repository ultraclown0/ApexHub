-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "statusLocked" BOOLEAN NOT NULL DEFAULT false;
