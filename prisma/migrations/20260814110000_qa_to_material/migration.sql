-- 10.1 采访问答挂到项目经历（方案 A）
-- QuestionAnswerRecord 加 projectMaterialId（可空），projectId 改可空；回填现有问答

-- 1. projectId 改可空
ALTER TABLE "QuestionAnswerRecord" ALTER COLUMN "projectId" DROP NOT NULL;

-- 2. 加 projectMaterialId 列
ALTER TABLE "QuestionAnswerRecord" ADD COLUMN "projectMaterialId" TEXT;

-- 3. 回填：把现有问答挂到"所属项目下最新一条项目材料"
--    （同一项目若有材料则关联最新一条；无材料保持 NULL）
UPDATE "QuestionAnswerRecord" qa
SET "projectMaterialId" = sub."id"
FROM (
  SELECT DISTINCT ON (pm."projectId") pm."id" AS "id", pm."projectId" AS "projectId"
  FROM "ProjectMaterial" pm
  ORDER BY pm."projectId", pm."updatedAt" DESC
) sub
WHERE qa."projectId" = sub."projectId";

-- 4. 索引（问答按素材查询）
CREATE INDEX IF NOT EXISTS "QuestionAnswerRecord_projectMaterialId_idx"
  ON "QuestionAnswerRecord" ("projectMaterialId");

-- 5. 外键
ALTER TABLE "QuestionAnswerRecord"
  ADD CONSTRAINT "QuestionAnswerRecord_projectMaterialId_fkey"
  FOREIGN KEY ("projectMaterialId") REFERENCES "ProjectMaterial" ("id") ON DELETE CASCADE;

-- 6. 外键（projectId 现在可空，保留原约束名但放宽引用行为不变）
-- 原有外键约束保留即可（projectId 列现在允许 NULL）
