import type { Metadata } from "next";
import { JdAnalysisWorkspace } from "@/components/jd-analysis-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectCard } from "@/lib/stage7-data";
import { getLatestJdRecord, getLatestMatchAnalysis, listMatchAnalysisVersions } from "@/lib/stage8-data";

export const metadata: Metadata = {
  title: "JD 分析"
};

export default async function JdAnalysisPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  let dataLoadError = "";
  let projects: Awaited<ReturnType<typeof listWorkspaceProjects>> = [];

  try {
    projects = await listWorkspaceProjects(userId);
  } catch (error) {
    console.error("JdAnalysisPage listWorkspaceProjects failed:", error);
    dataLoadError = `读取项目列表失败：${error instanceof Error ? error.message : String(error)}`;
  }

  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  if (!selectedProjectId) {
    return <JdAnalysisWorkspace projects={[]} selectedProjectId={null} initialJdText="" jdSavedAt={null} projectCardExists={false} capabilitySummary={null} matchAnalysis={null} versions={[]} dataLoadError={dataLoadError} />;
  }

  const appendLoadError = (label: string, error: unknown) => {
    console.error(`JdAnalysisPage ${label} failed:`, error);
    const message = `${label}失败：${error instanceof Error ? error.message : String(error)}`;
    dataLoadError = dataLoadError ? `${dataLoadError}\n${message}` : message;
  };

  const [projectCardResult, jdRecordResult, matchAnalysisResult, versionsResult] = await Promise.allSettled([
    getLatestProjectCard(selectedProjectId, userId),
    getLatestJdRecord(selectedProjectId, userId),
    getLatestMatchAnalysis(selectedProjectId, userId),
    listMatchAnalysisVersions(selectedProjectId, userId)
  ]);

  const projectCard = projectCardResult.status === "fulfilled" ? projectCardResult.value : null;
  const jdRecord = jdRecordResult.status === "fulfilled" ? jdRecordResult.value : null;
  const matchAnalysis = matchAnalysisResult.status === "fulfilled" ? matchAnalysisResult.value : null;
  const versions = versionsResult.status === "fulfilled" ? versionsResult.value : [];

  if (projectCardResult.status === "rejected") appendLoadError("读取项目卡片", projectCardResult.reason);
  if (jdRecordResult.status === "rejected") appendLoadError("读取 JD 记录", jdRecordResult.reason);
  if (matchAnalysisResult.status === "rejected") appendLoadError("读取匹配分析", matchAnalysisResult.reason);
  if (versionsResult.status === "rejected") appendLoadError("读取匹配分析版本", versionsResult.reason);

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
      dataLoadError={dataLoadError}
    />
  );
}
