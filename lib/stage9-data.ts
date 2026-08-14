import "server-only";

import { getLatestResumeMaterial, getResumeMaterialById, saveResumeMaterial } from "@/lib/stage6-data";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";
import { getLatestMatchAnalysis, getMatchAnalysisByJdRecord } from "@/lib/stage8-data";

export async function getResumeRewriteInputs(projectId: string, clerkUserId: string, jdId?: string, cardId?: string) {
  const projectCard = cardId
    ? await listProjectCards(clerkUserId).then((cards) => cards.find((card) => card.id === cardId) ?? null)
    : await getLatestProjectCard(projectId, clerkUserId);

  // 简历来源：优先取"卡片关联的简历"（设计：选了卡片自然改这张卡片关联的简历）；
  // 卡片未关联简历或没有卡片时，回退全局最新简历。
  const resumeMaterial = projectCard?.resumeMaterialId
    ? await getResumeMaterialById(projectCard.resumeMaterialId, clerkUserId)
    : await getLatestResumeMaterial(clerkUserId);

  const matchAnalysis = jdId
    ? await getMatchAnalysisByJdRecord(jdId, clerkUserId, cardId)
    : await getLatestMatchAnalysis(projectId, clerkUserId);

  return {
    resumeMaterial,
    projectCard,
    matchAnalysis
  };
}

export async function saveResumeRewriteContext(clerkUserId: string, rawText: string) {
  return saveResumeMaterial(clerkUserId, rawText);
}
