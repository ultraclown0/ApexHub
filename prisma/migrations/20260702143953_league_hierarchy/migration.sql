-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_LOBBY', 'MATCH_POINT', 'ROUND_ROBIN', 'BRACKET', 'LEAGUE', 'OTHER');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "format" "TournamentFormat";

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_LOBBY',
ADD COLUMN     "seasonId" TEXT,
ADD COLUMN     "splitId" TEXT;

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Split" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Split_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTeam" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seed" INTEGER,

    CONSTRAINT "GroupTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChampionshipPoint" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "ChampionshipPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_slug_key" ON "Season"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Split_slug_key" ON "Split"("slug");

-- CreateIndex
CREATE INDEX "Split_seasonId_idx" ON "Split"("seasonId");

-- CreateIndex
CREATE INDEX "Group_stageId_idx" ON "Group"("stageId");

-- CreateIndex
CREATE INDEX "GroupTeam_teamId_idx" ON "GroupTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupTeam_groupId_teamId_key" ON "GroupTeam"("groupId", "teamId");

-- CreateIndex
CREATE INDEX "ChampionshipPoint_seasonId_teamId_idx" ON "ChampionshipPoint"("seasonId", "teamId");

-- CreateIndex
CREATE INDEX "ChampionshipPoint_teamId_idx" ON "ChampionshipPoint"("teamId");

-- CreateIndex
CREATE INDEX "Stage_tournamentId_idx" ON "Stage"("tournamentId");

-- CreateIndex
CREATE INDEX "Tournament_seasonId_idx" ON "Tournament"("seasonId");

-- AddForeignKey
ALTER TABLE "Split" ADD CONSTRAINT "Split_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTeam" ADD CONSTRAINT "GroupTeam_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTeam" ADD CONSTRAINT "GroupTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionshipPoint" ADD CONSTRAINT "ChampionshipPoint_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionshipPoint" ADD CONSTRAINT "ChampionshipPoint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
