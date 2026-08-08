import type { Metadata } from "next";
import { ResumeRewriteWorkspace } from "@/components/resume-rewrite-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { getResumeRewriteInputs } from "@/lib/stage9-data";
import { listAbilityGaps } from "@/lib/memory-data";

export const metadata: Metadata = {
  title: "简历改写"
};

export default async function ResumeRewritePage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const [projects, abilityGaps] = await Promise.all([listWorkspaceProjects(userId), listAbilityGaps(userId)]);
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
        initialResumeText=""
        resumeSavedAt={null}
        projectCardExists={false}
        matchAnalysisExists={false}
        initialAbilityGaps={serializedGaps}
      />
    );
  }

  const { resumeMaterial, projectCard, matchAnalysis } = await getResumeRewriteInputs(selectedProjectId, userId);

  return (
    <ResumeRewriteWorkspace
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        targetRole: project.targetRole,
        currentNeed: project.currentNeed
      }))}
      selectedProjectId={selectedProjectId}
      initialResumeText={resumeMaterial?.rawText ?? ""}
      resumeSavedAt={resumeMaterial?.updatedAt.toISOString() ?? null}
      projectCardExists={Boolean(projectCard)}
      matchAnalysisExists={Boolean(matchAnalysis)}
      initialAbilityGaps={serializedGaps}
    />
  );
}
