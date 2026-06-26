-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "engine";

-- CreateEnum
CREATE TYPE "engine"."FlagState" AS ENUM ('on', 'off');

-- CreateEnum
CREATE TYPE "engine"."RuleKind" AS ENUM ('attribute', 'segment', 'percentage');

-- CreateEnum
CREATE TYPE "engine"."RuleOutcome" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "engine"."flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "short" TEXT NOT NULL DEFAULT '',
    "state" "engine"."FlagState" NOT NULL DEFAULT 'off',
    "default" "engine"."RuleOutcome" NOT NULL DEFAULT 'inactive',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."rules" (
    "id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "condition" JSONB NOT NULL,
    "kind" "engine"."RuleKind" NOT NULL,
    "outcome" "engine"."RuleOutcome" NOT NULL,
    "flagId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."segments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."segment_memberships" (
    "segmentId" UUID NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segment_memberships_pkey" PRIMARY KEY ("segmentId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "flags_key_key" ON "engine"."flags"("key");

-- CreateIndex
CREATE INDEX "flags_key_idx" ON "engine"."flags"("key");

-- CreateIndex
CREATE INDEX "rules_flagId_position_idx" ON "engine"."rules"("flagId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "rules_flagId_position_key" ON "engine"."rules"("flagId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "segments_name_key" ON "engine"."segments"("name");

-- CreateIndex
CREATE INDEX "segment_memberships_userId_idx" ON "engine"."segment_memberships"("userId");

-- AddForeignKey
ALTER TABLE "engine"."rules" ADD CONSTRAINT "rules_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "engine"."flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine"."segment_memberships" ADD CONSTRAINT "segment_memberships_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "engine"."segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
