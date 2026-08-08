-- CreateEnum
CREATE TYPE "MemorySourceType" AS ENUM ('RESUME', 'PROJECT_MATERIAL', 'INTERVIEW_ANSWER', 'INTERVIEW_FEEDBACK', 'REFLECTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "AbilityCategory" AS ENUM ('PERSONA', 'GENERAL', 'ROLE_SPECIFIC');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CitationKind" AS ENUM ('DIRECT_QUOTE', 'PARAPHRASE', 'INFERENCE');

-- CreateTable
CREATE TABLE "JdMemorySource" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "sourceType" "MemorySourceType" NOT NULL,
    "title" TEXT,
    "rawText" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdMemorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JdMemoryChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdMemoryChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JdAbilityTag" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AbilityCategory" NOT NULL,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "TagStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JdAbilityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JdOutputCitation" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "kind" "CitationKind" NOT NULL DEFAULT 'PARAPHRASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdOutputCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JdMemoryTagChunk" (
    "tagId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,

    CONSTRAINT "JdMemoryTagChunk_pkey" PRIMARY KEY ("tagId","chunkId")
);

-- CreateIndex
CREATE INDEX "JdMemorySource_clerkUserId_idx" ON "JdMemorySource"("clerkUserId");

-- CreateIndex
CREATE INDEX "JdMemoryChunk_sourceId_idx" ON "JdMemoryChunk"("sourceId");

-- CreateIndex
CREATE INDEX "JdAbilityTag_clerkUserId_idx" ON "JdAbilityTag"("clerkUserId");

-- CreateIndex
CREATE INDEX "JdAbilityTag_category_idx" ON "JdAbilityTag"("category");

-- CreateIndex
CREATE INDEX "JdOutputCitation_versionId_idx" ON "JdOutputCitation"("versionId");

-- AddForeignKey
ALTER TABLE "JdMemoryChunk" ADD CONSTRAINT "JdMemoryChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JdMemorySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JdOutputCitation" ADD CONSTRAINT "JdOutputCitation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VersionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JdMemoryTagChunk" ADD CONSTRAINT "JdMemoryTagChunk_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "JdAbilityTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JdMemoryTagChunk" ADD CONSTRAINT "JdMemoryTagChunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "JdMemoryChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
