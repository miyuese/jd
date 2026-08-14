import type { Metadata } from "next";
import { JdAnalysisWorkspace } from "@/components/jd-analysis-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectCard, listProjectCards } from "@/lib/stage7-data";
import {
  getJdRecordById,
  getLatestJdRecord,
  getLatestMatchAnalysis,
  getMatchAnalysisByJdRecord,
  listJdRecords,
  listMatchAnalysisVersions
} from "@/lib/stage8-data";

export const metadata: Metadata = {
  title: "JD 分析"
};

export default async function JdAnalysisPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[]; jdId?: string | string[]; cardId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  let dataLoadError = "";
  let projects: Awaited<ReturnType<typeof listWorkspaceProjects>> = [];
  let allCards: Awaited<ReturnType<typeof listProjectCards>> = [];

  try {
    [projects, allCards] = await Promise.all([
      listWorkspaceProjects(userId),
      listProjectCards(userId)
    ]);
  } catch (error) {
    console.error("JdAnalysisPage data load failed:", error);
    dataLoadError = `读取项目/卡片列表失败：${error instanceof Error ? error.message : String(error)}`;
  }

  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  if (!selectedProjectId) {
    return (
      <JdAnalysisWorkspace
        projects={[]}
        selectedProjectId={null}
        jdRecords={[]}
        selectedJdId={null}
        initialJdText=""
        jdSavedAt={null}
        projectCardExists={false}
        capabilitySummary={null}
        matchAnalysis={null}
        versions={[]}
        cards={[]}
        selectedCardId={null}
        dataLoadError={dataLoadError}
      />
    );
  }

  const appendLoadError = (label: string, error: unknown) => {
    console.error(`JdAnalysisPage ${label} failed:`, error);
    const message = `${label}失败：${error instanceof Error ? error.message : String(error)}`;
    dataLoadError = dataLoadError ? `${dataLoadError}\n${message}` : message;
  };

  const [projectCardResult, jdRecordsResult, latestJdResult] = await Promise.allSettled([
    getLatestProjectCard(selectedProjectId, userId),
    listJdRecords(selectedProjectId, userId),
    getLatestJdRecord(selectedProjectId, userId)
  ]);

  const projectCard = projectCardResult.status === "fulfilled" ? projectCardResult.value : null;
  const jdRecords = jdRecordsResult.status === "fulfilled" ? jdRecordsResult.value : [];
  const latestJd = latestJdResult.status === "fulfilled" ? latestJdResult.value : null;

  if (projectCardResult.status === "rejected") appendLoadError("读取项目卡片", projectCardResult.reason);
  if (jdRecordsResult.status === "rejected") appendLoadError("读取 JD 记录", jdRecordsResult.reason);
  if (latestJdResult.status === "rejected") appendLoadError("读取最新 JD", latestJdResult.reason);

  // 选中的 JD：URL 指定优先，否则用最新
  const requestedJdId = Array.isArray(searchParams?.jdId) ? searchParams?.jdId[0] : searchParams?.jdId;
  const selectedJdId = jdRecords.some((jd) => jd.id === requestedJdId)
    ? requestedJdId ?? null
    : (latestJd?.id ?? null);

  let jdRecord = latestJd;
  let matchAnalysis: Awaited<ReturnType<typeof getLatestMatchAnalysis>> = null;

  // 选中的卡片：URL 指定优先，否则用最新
  const requestedCardId = Array.isArray(searchParams?.cardId) ? searchParams?.cardId[0] : searchParams?.cardId;
  const selectedCardId = allCards.some((card) => card.id === requestedCardId)
    ? requestedCardId ?? null
    : (projectCard?.id ?? null);

  if (selectedJdId) {
    const [jdResult, matchResult] = await Promise.allSettled([
      getJdRecordById(selectedJdId, userId),
      getMatchAnalysisByJdRecord(selectedJdId, userId, selectedCardId)
    ]);
    jdRecord = jdResult.status === "fulfilled" ? jdResult.value : null;
    matchAnalysis = matchResult.status === "fulfilled" ? matchResult.value : null;
    if (jdResult.status === "rejected") appendLoadError("读取选中 JD", jdResult.reason);
    if (matchResult.status === "rejected") appendLoadError("读取匹配分析", matchResult.reason);
  }

  // 版本列表按当前选中的交叉点（卡片 × JD）查询
  const versionsResult = await listMatchAnalysisVersions(selectedProjectId, userId, {
    projectCardId: selectedCardId,
    jdRecordId: selectedJdId
  }).catch((error) => {
    appendLoadError("读取匹配分析版本", error);
    return [] as Awaited<ReturnType<typeof listMatchAnalysisVersions>>;
  });
  const versions = versionsResult;

  const capabilitySummary = jdRecord?.capabilitySummary as
    | {
        responsibilities?: string[];
        capabilities?: string[];
        priorities?: Array<{ label: string; level: string }>;
      }
    | null;

  return (
    <JdAnalysisWorkspace
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
        hasSummary: Boolean(
          (jd.capabilitySummary as { responsibilities?: unknown[] } | null)?.responsibilities?.length
        ),
        updatedAt: jd.updatedAt.toISOString()
      }))}
      selectedJdId={selectedJdId}
      initialJdText={jdRecord?.rawText ?? ""}
      jdSavedAt={jdRecord?.updatedAt.toISOString() ?? null}
      projectCardExists={Boolean(projectCard)}
      capabilitySummary={
        capabilitySummary?.responsibilities?.length && capabilitySummary.capabilities?.length && capabilitySummary.priorities?.length
          ? {
              responsibilities: capabilitySummary.responsibilities,
              capabilities: capabilitySummary.capabilities,
              priorities: capabilitySummary.priorities
            }
          : null
      }
      matchAnalysis={
        matchAnalysis
          ? {
              id: matchAnalysis.id,
              matchedPoints: Array.isArray(matchAnalysis.matchedPoints) ? (matchAnalysis.matchedPoints as string[]) : [],
              gapPoints: Array.isArray(matchAnalysis.gapPoints) ? (matchAnalysis.gapPoints as string[]) : [],
              suggestionPoints: Array.isArray(matchAnalysis.suggestionPoints) ? (matchAnalysis.suggestionPoints as string[]) : [],
              plainExplanations:
                typeof matchAnalysis.plainExplanations === "object" && matchAnalysis.plainExplanations !== null
                  ? {
                      matchedPoints:
                        typeof (matchAnalysis.plainExplanations as { matchedPoints?: unknown }).matchedPoints === "string"
                          ? ((matchAnalysis.plainExplanations as { matchedPoints?: string }).matchedPoints ?? "")
                          : "",
                      gapPoints:
                        typeof (matchAnalysis.plainExplanations as { gapPoints?: unknown }).gapPoints === "string"
                          ? ((matchAnalysis.plainExplanations as { gapPoints?: string }).gapPoints ?? "")
                          : "",
                      suggestionPoints:
                        typeof (matchAnalysis.plainExplanations as { suggestionPoints?: unknown }).suggestionPoints === "string"
                          ? ((matchAnalysis.plainExplanations as { suggestionPoints?: string }).suggestionPoints ?? "")
                          : ""
                    }
                  : {
                      matchedPoints: "",
                      gapPoints: "",
                      suggestionPoints: ""
                    },
              summary: matchAnalysis.summary ?? "",
              status: matchAnalysis.status as "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED",
              updatedAt: matchAnalysis.updatedAt.toISOString()
            }
          : null
      }
      versions={versions.map((version) => ({
        id: version.id,
        title: version.title,
        createdAt: version.createdAt.toISOString()
      }))}
      cards={allCards.map((card) => ({
        id: card.id,
        title: card.title ?? "未命名卡片",
        updatedAt: card.updatedAt.toISOString()
      }))}
      selectedCardId={selectedCardId}
      dataLoadError={dataLoadError}
    />
  );
}
