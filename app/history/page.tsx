import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { listAllVersions, listProjectsWithVersions } from "@/lib/stage11-data";
import { HistoryWorkspace } from "@/components/history-workspace";

export const metadata: Metadata = {
  title: "历史版本"
};

export default async function HistoryPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const projectsWithVersions = await listProjectsWithVersions(userId);

  const requestedProjectId = Array.isArray(searchParams?.projectId)
    ? searchParams?.projectId[0]
    : searchParams?.projectId;

  const selectedProjectId = projectsWithVersions.some((p) => p.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projectsWithVersions[0]?.id ?? null;

  const versions = selectedProjectId ? await listAllVersions(selectedProjectId, userId) : [];

  return (
    <HistoryWorkspace
      projects={projectsWithVersions.map((p) => ({
        id: p.id,
        name: p.name,
        targetRole: p.targetRole,
        versionCount: p.versionCount
      }))}
      selectedProjectId={selectedProjectId}
      initialVersions={versions.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString()
      }))}
    />
  );
}
