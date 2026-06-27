-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "engine";

-- CreateTable
CREATE TABLE "engine"."flags" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "short" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."rules" (
    "id" UUID NOT NULL,
    "flagId" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "outcome" BOOLEAN NOT NULL,
    "rollout" SMALLINT DEFAULT 100,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."segments" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine"."conditions" (
    "id" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "attribute" VARCHAR(50) NOT NULL,
    "operator" VARCHAR(20) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flags_key_key" ON "engine"."flags"("key");

-- CreateIndex
CREATE INDEX "rules_flagId_priority_idx" ON "engine"."rules"("flagId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "segments_key_key" ON "engine"."segments"("key");

-- CreateIndex
CREATE INDEX "conditions_segmentId_idx" ON "engine"."conditions"("segmentId");

-- AddForeignKey
ALTER TABLE "engine"."rules" ADD CONSTRAINT "rules_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "engine"."segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine"."rules" ADD CONSTRAINT "rules_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "engine"."flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine"."conditions" ADD CONSTRAINT "conditions_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "engine"."segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
