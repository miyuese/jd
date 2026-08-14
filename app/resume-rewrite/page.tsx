import type { Metadata } from "next";
import { ResumeRewriteWorkspace } from "@/components/resume-rewrite-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getResumeRewriteInputs } from "@/lib/stage9-data";
import { getAbilityTagStats, listAbilityGaps } from "@/lib/memory-data";
import { getLatestJdRecord, listJdRecords } from "@/lib/stage8-data";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";

export const metadata: Metadata = {
  title: "简历改写"
};

export default async function ResumeRewritePage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[]; jdId?: string | string[]; cardId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const [projects, abilityGaps, abilityTagStats, allCards] = await Promise.all([
    listWorkspaceProjects(userId),
    listAbilityGaps(userId),
    getAbilityTagStats(userId),
    listProjectCards(userId)
  ]);
  const serializedGaps = abilityGaps.map((gap) => ({
    ...gap,
    updatedAt: gap.updatedAt instanceof Date ? gap.updatedAt.toISOString() : String(gap.updatedAt)
  }));
  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  if (!selectedProjectId) {
    return (
      <ResumeRewriteWorkspace
        projects={[]}
        selectedProjectId={null}
        jdRecords={[]}
        selectedJdId={null}
        cards={[]}
        selectedCardId={null}
        initialResumeText=""
        resumeSavedAt={null}
        projectCardExists={false}
        matchAnalysisExists={false}
        initialAbilityGaps={serializedGaps}
        initialRadarScores={null}
      />
    );
  }

  const [jdRecords, latestJd, projectCard] = await Promise.all([
    listJdRecords(selectedProjectId, userId),
    getLatestJdRecord(selectedProjectId, userId),
    getLatestProjectCard(selectedProjectId, userId)
  ]);
  const requestedJdId = Array.isArray(searchParams?.jdId) ? searchParams?.jdId[0] : searchParams?.jdId;
  const selectedJdId = jdRecords.some((jd) => jd.id === requestedJdId)
    ? requestedJdId ?? null
    : (latestJd?.id ?? null);

  const requestedCardId = Array.isArray(searchParams?.cardId) ? searchParams?.cardId[0] : searchParams?.cardId;
  const selectedCardId = allCards.some((card) => card.id === requestedCardId)
    ? requestedCardId ?? null
    : (projectCard?.id ?? null);

  const { resumeMaterial, projectCard: resolvedProjectCard, matchAnalysis } = await getResumeRewriteInputs(
    selectedProjectId,
    userId,
    selectedJdId ?? undefined,
    selectedCardId ?? undefined
  );

  // 雷达图数据：我的画像（来自记忆库能力标签）vs JD 要求（来自匹配分析的优先级）
  const myScores = {
    PERSONA: Math.min(100, Math.round(abilityTagStats.PERSONA.count * 15 + abilityTagStats.PERSONA.avgConfidence * 35)),
    GENERAL: Math.min(100, Math.round(abilityTagStats.GENERAL.count * 15 + abilityTagStats.GENERAL.avgConfidence * 35)),
    ROLE_SPECIFIC: Math.min(100, Math.round(abilityTagStats.ROLE_SPECIFIC.count * 15 + abilityTagStats.ROLE_SPECIFIC.avgConfidence * 35))
  };

  const matchedPoints = matchAnalysis?.matchedPoints as unknown[] | undefined;
  const matchedScore = matchedPoints?.length ? Math.min(100, Math.round((matchedPoints.length / 5) * 100)) : 0;

  // JD 期望用合理基准（综合素质 / 通用能力 / 岗位能力），匹配覆盖跟随真实数据
  const initialRadarScores = {
    my: myScores,
    jd: {
      PERSONA: 65,
      GENERAL: 70,
      ROLE_SPECIFIC: 75,
      MATCHED: matchedScore
    }
  };

  return (
    <ResumeRewriteWorkspace
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        targetRole: project.targetRole,
        currentNeed: project.currentNeed
      }))}
      selectedProjectId={selectedProjectId}
      jdRecords={jdRecords.map((jd) => ({
        id: jd.id,
        rawText: jd.rawText,
        hasSummary: Boolean((jd.capabilitySummary as { responsibilities?: unknown[] } | null)?.responsibilities?.length),
        updatedAt: jd.updatedAt.toISOString()
      }))}
      selectedJdId={selectedJdId}
      cards={allCards.map((card) => ({
        id: card.id,
        title: card.title ?? "未命名卡片",
        updatedAt: card.updatedAt.toISOString()
      }))}
      selectedCardId={selectedCardId}
      initialResumeText={resumeMaterial?.rawText ?? ""}
      resumeSavedAt={resumeMaterial?.updatedAt.toISOString() ?? null}
      projectCardExists={Boolean(resolvedProjectCard)}
      matchAnalysisExists={Boolean(matchAnalysis)}
      initialAbilityGaps={serializedGaps}
      initialRadarScores={initialRadarScores}
    />
  );
}
