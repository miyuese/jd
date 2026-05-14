import type { Metadata } from "next";
import { ProjectCardWorkspace } from "@/components/project-card-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { getWorkspaceProjectById, listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectMaterial, listQuestionAnswerTimeline } from "@/lib/stage6-data";
import { getLatestProjectCard, listProjectCardVersions } from "@/lib/stage7-data";

export const metadata: Metadata = {
  title: "项目卡片确认"
};

export default async function ProjectCardPage({
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
    return (
      <ProjectCardWorkspace
        projects={[]}
        selectedProjectId={null}
        initialCard={null}
        projectMaterialExists={false}
        questionAnswerCount={0}
        versions={[]}
      />
    );
  }

  const [project, material, timeline, card, versions] = await Promise.all([
    getWorkspaceProjectById(selectedProjectId, userId),
    getLatestProjectMaterial(selectedProjectId, userId),
    listQuestionAnswerTimeline(selectedProjectId, userId),
    getLatestProjectCard(selectedProjectId, userId),
    listProjectCardVersions(selectedProjectId, userId)
  ]);

  return (
    <ProjectCardWorkspace
      projects={projects.map((item) => ({
        id: item.id,
        name: item.name,
        targetRole: item.targetRole,
        currentNeed: item.currentNeed
      }))}
      selectedProjectId={selectedProjectId}
      initialCard={
        card
          ? {
              id: card.id,
              title: card.title ?? (project?.name ?? "项目卡片草稿"),
              background: card.background ?? "",
              backgroundFactStatus: card.backgroundFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
              responsibility: card.responsibility ?? "",
              responsibilityFactStatus: card.responsibilityFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
              result: card.result ?? "",
              resultFactStatus: card.resultFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
              status: card.status as "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED",
              updatedAt: card.updatedAt.toISOString()
            }
          : null
      }
      projectMaterialExists={Boolean(material?.rawText.trim())}
      questionAnswerCount={timeline.length}
      versions={versions.map((version) => ({
        id: version.id,
        title: version.title,
        createdAt: version.createdAt.toISOString()
      }))}
    />
  );
}
