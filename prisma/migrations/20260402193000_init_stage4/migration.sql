-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaterialSourceType" AS ENUM ('MANUAL_TEXT', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "FactStatus" AS ENUM ('CONFIRMED', 'NEEDS_CONFIRMATION', 'EXPRESSION_SUGGESTION');

-- CreateEnum
CREATE TYPE "ProjectCardStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MatchAnalysisStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('PROJECT_CARD', 'MATCH_ANALYSIS', 'OUTPUT');

-- CreateTable
CREATE TABLE "ResumeMaterial" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '已有简历',
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "currentNeed" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterial" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "sourceType" "MaterialSourceType" NOT NULL DEFAULT 'MANUAL_TEXT',
    "title" TEXT,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswerRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL DEFAULT 1,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAnswerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "title" TEXT,
    "background" TEXT,
    "backgroundFactStatus" "FactStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "responsibility" TEXT,
    "responsibilityFactStatus" "FactStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "result" TEXT,
    "resultFactStatus" "FactStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "status" "ProjectCardStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JdRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "capabilitySummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JdRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jdRecordId" TEXT,
    "clerkUserId" TEXT NOT NULL,
    "status" "MatchAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
    "matchedPoints" JSONB,
    "gapPoints" JSONB,
    "suggestionPoints" JSONB,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "type" "VersionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sourceResumeMaterialId" TEXT,
    "sourceProjectCardId" TEXT,
    "sourceMatchAnalysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectMaterial" ADD CONSTRAINT "ProjectMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerRecord" ADD CONSTRAINT "QuestionAnswerRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCard" ADD CONSTRAINT "ProjectCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JdRecord" ADD CONSTRAINT "JdRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysis" ADD CONSTRAINT "MatchAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnalysis" ADD CONSTRAINT "MatchAnalysis_jdRecordId_fkey" FOREIGN KEY ("jdRecordId") REFERENCES "JdRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionRecord" ADD CONSTRAINT "VersionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
