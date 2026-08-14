-- M1：素材层多份化
-- 1. ProjectMaterial.projectId 改为可空（素材独立于计划）
-- 2. ProjectMaterial 新增 projectName（防材料打架，回填所属项目名）
-- 3. ResumeMaterial / ProjectMaterial 加 (clerkUserId, updatedAt) 索引（多份列表查询）

ALTER TABLE "ProjectMaterial" ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProjectMaterial" ADD COLUMN "projectName" TEXT;

UPDATE "ProjectMaterial" AS pm
SET "projectName" = p."name"
FROM "Project" AS p
WHERE pm."projectId" IS NOT NULL AND pm."projectId" = p."id";

CREATE INDEX "ResumeMaterial_clerkUserId_updatedAt_idx" ON "ResumeMaterial"("clerkUserId", "updatedAt");
CREATE INDEX "ProjectMaterial_clerkUserId_updatedAt_idx" ON "ProjectMaterial"("clerkUserId", "updatedAt");
