-- M2+M3：卡片组合化 + 交叉产物维度
-- 1. ProjectCard.projectId 改可空 + 新增 resumeMaterialId（卡片可独立于计划）
-- 2. 新表 ProjectCardMaterial（卡片 × 多份经历关联）
-- 3. MatchAnalysis.projectId 改可空 + 新增 projectCardId（交叉点维度）
-- 4. VersionRecord.projectId 改可空 + 新增 jdRecordId
-- 5. 索引

ALTER TABLE "ProjectCard" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "ProjectCard" ADD COLUMN "resumeMaterialId" TEXT;
CREATE INDEX "ProjectCard_clerkUserId_updatedAt_idx" ON "ProjectCard"("clerkUserId", "updatedAt");

CREATE TABLE "ProjectCardMaterial" (
    "id" TEXT NOT NULL,
    "projectCardId" TEXT NOT NULL,
    "projectMaterialId" TEXT NOT NULL,
    CONSTRAINT "ProjectCardMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectCardMaterial_projectCardId_projectMaterialId_key" ON "ProjectCardMaterial"("projectCardId", "projectMaterialId");

ALTER TABLE "MatchAnalysis" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "MatchAnalysis" ADD COLUMN "projectCardId" TEXT;
CREATE INDEX "MatchAnalysis_clerkUserId_updatedAt_idx" ON "MatchAnalysis"("clerkUserId", "updatedAt");

ALTER TABLE "VersionRecord" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "VersionRecord" ADD COLUMN "jdRecordId" TEXT;
CREATE INDEX "VersionRecord_clerkUserId_createdAt_idx" ON "VersionRecord"("clerkUserId", "createdAt");
