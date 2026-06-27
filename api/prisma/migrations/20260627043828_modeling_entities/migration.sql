-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "engine";

-- CreateEnum
CREATE TYPE "engine"."RuleOutcome" AS ENUM ('on', 'off', 'rollout');

-- CreateTable
CREATE TABLE "engine"."flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flagId" UUID NOT NULL,
    "segmentId" UUID,
    "priority" INTEGER NOT NULL,
    "conditions" JSONB,
    "outcome" "engine"."RuleOutcome" NOT NULL,
    "rollout" SMALLINT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flags_key_key" ON "engine"."flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "segments_key_key" ON "engine"."segments"("key");

-- CreateIndex
CREATE INDEX "rules_flagId_priority_idx" ON "engine"."rules"("flagId", "priority");

-- AddForeignKey
ALTER TABLE "engine"."rules" ADD CONSTRAINT "rules_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "engine"."flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine"."rules" ADD CONSTRAINT "rules_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "engine"."segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
