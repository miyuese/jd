import type { Metadata } from "next";
import { ProjectCardWorkspace } from "@/components/project-card-workspace";
import { requireClerkUserId } from "@/lib/auth-scope";
import { getWorkspaceProjectById, listWorkspaceProjects } from "@/lib/neon-db";
import { getLatestProjectMaterial, listProjectMaterials, listQuestionAnswerTimeline, listResumeMaterials } from "@/lib/stage6-data";
import { getLatestProjectCard, listProjectCardVersions, listProjectCards } from "@/lib/stage7-data";

export const metadata: Metadata = {
  title: "项目卡片确认"
};

export default async function ProjectCardPage({
  searchParams
}: {
  searchParams?: { projectId?: string | string[]; cardId?: string | string[] };
}) {
  const userId = requireClerkUserId();
  const projects = await listWorkspaceProjects(userId);
  const requestedProjectId = Array.isArray(searchParams?.projectId) ? searchParams?.projectId[0] : searchParams?.projectId;
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId ?? null
    : projects[0]?.id ?? null;

  // 组合选择用的素材列表（简历多份 + 项目经历多份）
  const [resumes, allMaterials, allCards] = await Promise.all([
    listResumeMaterials(userId),
    listProjectMaterials(userId),
    listProjectCards(userId)
  ]);

  // 从卡片库跳转：按 cardId 定位指定卡片（不依赖项目）
  const requestedCardId = Array.isArray(searchParams?.cardId) ? searchParams?.cardId[0] : searchParams?.cardId;
  const libraryCard = requestedCardId ? allCards.find((card) => card.id === requestedCardId) ?? null : null;

  if (!selectedProjectId && !libraryCard) {
    return (
      <ProjectCardWorkspace
        projects={[]}
        selectedProjectId={null}
        initialCard={null}
        projectMaterialExists={false}
        questionAnswerCount={0}
        versions={[]}
        resumes={resumes.map((item) => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt.toISOString()
        }))}
        materials={allMaterials.map((item) => ({
          id: item.id,
          title: item.projectName ?? item.title ?? "未命名项目",
          updatedAt: item.updatedAt.toISOString()
        }))}
      />
    );
  }

  // 卡片库场景：直接按 cardId 读取卡片与版本
  if (libraryCard) {
    const versions = await listProjectCardVersions(libraryCard.projectId, userId, libraryCard.id);

    return (
      <ProjectCardWorkspace
        projects={projects.map((item) => ({
          id: item.id,
          name: item.name,
          targetRole: item.targetRole,
          currentNeed: item.currentNeed
        }))}
        selectedProjectId={projects.some((p) => p.id === libraryCard.projectId) ? libraryCard.projectId : null}
        initialCard={{
          id: libraryCard.id,
          title: libraryCard.title ?? "项目卡片草稿",
          background: libraryCard.background ?? "",
          backgroundFactStatus: libraryCard.backgroundFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
          responsibility: libraryCard.responsibility ?? "",
          responsibilityFactStatus: libraryCard.responsibilityFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
          result: libraryCard.result ?? "",
          resultFactStatus: libraryCard.resultFactStatus as "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION",
          status: libraryCard.status as "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED",
          updatedAt: libraryCard.updatedAt.toISOString()
        }}
        projectMaterialExists={false}
        questionAnswerCount={0}
        versions={versions.map((version) => ({
          id: version.id,
          title: version.title,
          createdAt: version.createdAt.toISOString()
        }))}
        resumes={resumes.map((item) => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt.toISOString()
        }))}
        materials={allMaterials.map((item) => ({
          id: item.id,
          title: item.projectName ?? item.title ?? "未命名项目",
          updatedAt: item.updatedAt.toISOString()
        }))}
      />
    );
  }

  // 走到这里说明没有卡片库跳转且 selectedProjectId 存在（前面的分支已处理 null 情况）
  if (!selectedProjectId) {
    return null;
  }

  const [project, material, timeline, card] = await Promise.all([
    getWorkspaceProjectById(selectedProjectId, userId),
    getLatestProjectMaterial(selectedProjectId, userId),
    listQuestionAnswerTimeline({ projectId: selectedProjectId }, userId),
    getLatestProjectCard(selectedProjectId, userId)
  ]);

  // 版本记录按当前卡片查询（10.3：多张卡片版本互不混淆）
  const versions = card
    ? await listProjectCardVersions(card.projectId, userId, card.id)
    : await listProjectCardVersions(selectedProjectId, userId);

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
      resumes={resumes.map((item) => ({
        id: item.id,
        title: item.title,
        updatedAt: item.updatedAt.toISOString()
      }))}
      materials={allMaterials.map((item) => ({
        id: item.id,
        title: item.projectName ?? item.title ?? "未命名项目",
        updatedAt: item.updatedAt.toISOString()
      }))}
    />
  );
}
