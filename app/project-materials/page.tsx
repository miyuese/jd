import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { ProjectMaterialsWorkspace } from "@/components/project-materials-workspace";
import { getLatestProjectMaterial, listQuestionAnswerTimeline } from "@/lib/stage6-data";

export const metadata: Metadata = {
  title: "项目材料"
};

export default async function ProjectMaterialsPage({
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

  const material = selectedProjectId ? await getLatestProjectMaterial(selectedProjectId, userId) : null;
  const timeline = selectedProjectId ? await listQuestionAnswerTimeline(selectedProjectId, userId) : [];

  return (
    <ProjectMaterialsWorkspace
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        targetRole: project.targetRole,
        currentNeed: project.currentNeed
      }))}
      selectedProjectId={selectedProjectId}
      initialMaterialContent={material?.rawText ?? ""}
      materialSavedAt={material?.updatedAt.toISOString() ?? null}
      initialTimeline={timeline.map((item) => ({
        id: item.id,
        roundIndex: item.roundIndex,
        questionText: item.questionText,
        answerText: item.answerText,
        createdAt: item.createdAt.toISOString()
      }))}
    />
  );
}
