import "server-only";

import { getLatestResumeMaterial, saveResumeMaterial } from "@/lib/stage6-data";
import { getLatestProjectCard } from "@/lib/stage7-data";
import { getLatestMatchAnalysis } from "@/lib/stage8-data";

export async function getResumeRewriteInputs(projectId: string, clerkUserId: string) {
  const [resumeMaterial, projectCard, matchAnalysis] = await Promise.all([
    getLatestResumeMaterial(clerkUserId),
    getLatestProjectCard(projectId, clerkUserId),
    getLatestMatchAnalysis(projectId, clerkUserId)
  ]);

  return {
    resumeMaterial,
    projectCard,
    matchAnalysis
  };
}

export async function saveResumeRewriteContext(clerkUserId: string, rawText: string) {
  return saveResumeMaterial(clerkUserId, rawText);
}
