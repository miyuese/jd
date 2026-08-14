import type { Metadata } from "next";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listWorkspaceProjects } from "@/lib/neon-db";
import { listAllVersions, listProjectsWithVersions } from "@/lib/stage11-data";
import { listProjectCards } from "@/lib/stage7-data";
import { listJdRecords } from "@/lib/stage8-data";
import { HistoryWorkspace } from "@/components/history-workspace";

export const metadata: Metadata = {
  title: "历史版本"
};

export default async function HistoryPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[]; cardId?: string | string[]; jdId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const [projectsWithVersions, allCards] = await Promise.all([
    listProjectsWithVersions(userId),
    listProjectCards(userId)
  ]);

  const requestedProjectId = Array.isArray(searchParams?.projectId)
    ? searchParams?.projectId[0]
    : searchParams?.projectId;

  const selectedProjectId = projectsWithVersions.some((p) => p.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projectsWithVersions[0]?.id ?? null;

  // 交叉筛选参数：选中的卡片 × JD
  const requestedCardId = Array.isArray(searchParams?.cardId) ? searchParams?.cardId[0] : searchParams?.cardId;
  const selectedCardId = allCards.some((card) => card.id === requestedCardId)
    ? requestedCardId ?? null
    : null;

  const jdRecords = selectedProjectId ? await listJdRecords(selectedProjectId, userId) : [];
  const requestedJdId = Array.isArray(searchParams?.jdId) ? searchParams?.jdId[0] : searchParams?.jdId;
  const selectedJdId = jdRecords.some((jd) => jd.id === requestedJdId)
    ? requestedJdId ?? null
    : null;

  // 版本查询：有交叉点时按卡片×JD 过滤，否则按项目
  const versions = selectedProjectId
    ? await listAllVersions(selectedProjectId, userId, {
        projectCardId: selectedCardId,
        jdRecordId: selectedJdId
      })
    : [];

  return (
    <HistoryWorkspace
      projects={projectsWithVersions.map((p) => ({
        id: p.id,
        name: p.name,
        targetRole: p.targetRole,
        versionCount: p.versionCount
      }))}
      selectedProjectId={selectedProjectId}
      cards={allCards.map((card) => ({
        id: card.id,
        title: card.title ?? "未命名卡片"
      }))}
      selectedCardId={selectedCardId}
      jdRecords={jdRecords.map((jd, index) => ({
        id: jd.id,
        title: `JD #${jdRecords.length - index}`
      }))}
      selectedJdId={selectedJdId}
      initialVersions={versions.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString()
      }))}
    />
  );
}
