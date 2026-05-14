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
  const projects = await listWorkspaceProjects(userId);
  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  if (!selectedProjectId) {
    return <JdAnalysisWorkspace projects={[]} selectedProjectId={null} initialJdText="" jdSavedAt={null} projectCardExists={false} capabilitySummary={null} matchAnalysis={null} versions={[]} />;
  }

  const [projectCard, jdRecord, matchAnalysis, versions] = await Promise.all([
    getLatestProjectCard(selectedProjectId, userId),
    getLatestJdRecord(selectedProjectId, userId),
    getLatestMatchAnalysis(selectedProjectId, userId),
    listMatchAnalysisVersions(selectedProjectId, userId)
  ]);

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
    />
  );
}
