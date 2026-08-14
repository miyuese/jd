import type { Metadata } from "next";
import { InterviewPrepWorkspace } from "@/components/interview-prep-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";
import { getMatchAnalysisByJdRecord, getLatestJdRecord, listJdRecords } from "@/lib/stage8-data";
import { listInterviewOutputVersions } from "@/lib/stage10-data";
import { listAbilityGaps } from "@/lib/memory-data";

export const metadata: Metadata = {
  title: "面试准备"
};

async function getLatestInterviewOutputs(projectId: string, userId: string, sourceProjectCardId?: string | null, jdRecordId?: string | null) {
  const versions = await listInterviewOutputVersions(projectId, userId, sourceProjectCardId, jdRecordId);

  const oneMinuteIntro = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "ONE_MINUTE_INTRO";
  });

  const threeMinuteStory = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "THREE_MINUTE_STORY";
  });

  const questionsVersion = versions.find((v) => {
    const content = v.content as { type?: string };
    return content?.type === "INTERVIEW_QUESTIONS";
  });

  return {
    oneMinuteIntro: oneMinuteIntro ? (oneMinuteIntro.content as { script?: string }).script ?? null : null,
    threeMinuteStory: threeMinuteStory ? (threeMinuteStory.content as { script?: string }).script ?? null : null,
    questions: questionsVersion ? (questionsVersion.content as { questions?: string[] }).questions ?? null : null
  };
}

export default async function InterviewPrepPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[]; jdId?: string | string[]; cardId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const [projects, abilityGaps, allCards] = await Promise.all([
    listWorkspaceProjects(userId),
    listAbilityGaps(userId),
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
      <InterviewPrepWorkspace
        projects={[]}
        selectedProjectId={null}
        jdRecords={[]}
        selectedJdId={null}
        cards={[]}
        selectedCardId={null}
        projectCardExists={false}
        matchAnalysisExists={false}
        latestOutput={{
          oneMinuteIntro: null,
          threeMinuteStory: null,
          questions: null
        }}
        initialAbilityGaps={serializedGaps}
      />
    );
  }

  const [projectCard, jdRecords, latestJd] = await Promise.all([
    getLatestProjectCard(selectedProjectId, userId),
    listJdRecords(selectedProjectId, userId),
    getLatestJdRecord(selectedProjectId, userId)
  ]);
  const requestedJdId = Array.isArray(searchParams?.jdId) ? searchParams?.jdId[0] : searchParams?.jdId;
  const selectedJdId = jdRecords.some((jd) => jd.id === requestedJdId)
    ? requestedJdId ?? null
    : (latestJd?.id ?? null);

  const requestedCardId = Array.isArray(searchParams?.cardId) ? searchParams?.cardId[0] : searchParams?.cardId;
  const selectedCardId = allCards.some((card) => card.id === requestedCardId)
    ? requestedCardId ?? null
    : (projectCard?.id ?? null);

  // 按选中的卡片 × JD 交叉点读取匹配分析（状态灯与生成逻辑一致，不再用"整个计划有没有"粗判断）
  const crossMatchAnalysis = selectedJdId
    ? await getMatchAnalysisByJdRecord(selectedJdId, userId, selectedCardId)
    : null;

  // 每条 JD 是否已有匹配分析（用于下拉框三态标签：已解析·有分析 / 已解析·无分析 / 未解析）
  const jdAnalysisStatus = new Map<string, boolean>();
  for (const jd of jdRecords) {
    const exists = await getMatchAnalysisByJdRecord(jd.id, userId, selectedCardId);
    jdAnalysisStatus.set(jd.id, Boolean(exists));
  }

  // 按选中的卡片 × JD 交叉点读取输出（保证"卡片A×JD1"和"卡片B×JD1"的输出互不串台）
  const crossOutput = await getLatestInterviewOutputs(selectedProjectId, userId, selectedCardId, selectedJdId);

  return (
    <InterviewPrepWorkspace
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
        hasAnalysis: jdAnalysisStatus.get(jd.id) ?? false,
        updatedAt: jd.updatedAt.toISOString()
      }))}
      selectedJdId={selectedJdId}
      cards={allCards.map((card) => ({
        id: card.id,
        title: card.title ?? "未命名卡片",
        updatedAt: card.updatedAt.toISOString()
      }))}
      selectedCardId={selectedCardId}
      projectCardExists={Boolean(projectCard)}
      matchAnalysisExists={Boolean(crossMatchAnalysis)}
      latestOutput={crossOutput}
      initialAbilityGaps={serializedGaps}
    />
  );
}
