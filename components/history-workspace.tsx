"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getProjectVersionsAction, restoreVersionAction } from "@/app/history/actions";
import { EmptyState } from "@/components/empty-state";
import { ErrorDisplay } from "@/components/error-display";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  versionCount: number;
};

type VersionItem = {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: unknown;
  sourceResumeMaterialId: string | null;
  sourceProjectCardId: string | null;
  sourceMatchAnalysisId: string | null;
  jdRecordId: string | null;
  createdAt: string;
};

type CardOption = {
  id: string;
  title: string;
};

type JdOption = {
  id: string;
  title: string;
};

type HistoryWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  allProjectCount: number;
  cards: CardOption[];
  selectedCardId: string | null;
  jdRecords: JdOption[];
  selectedJdId: string | null;
  initialVersions: VersionItem[];
};

const typeConfig: Record<string, { label: string; color: string }> = {
  PROJECT_CARD: { label: "项目卡片", color: "bg-blue-100 text-blue-800" },
  MATCH_ANALYSIS: { label: "匹配分析", color: "bg-emerald-100 text-emerald-800" },
  OUTPUT: { label: "输出版本", color: "bg-purple-100 text-purple-800" }
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;
  return formatDateTime(value);
}

function getContentPreview(content: unknown): string {
  if (!content) return "无内容预览";

  if (typeof content === "string") {
    return content.slice(0, 120) + (content.length > 120 ? "..." : "");
  }

  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;

    if (obj.script && typeof obj.script === "string") {
      return obj.script.slice(0, 120) + (obj.script.length > 120 ? "..." : "");
    }

    if (obj.rewrite && typeof obj.rewrite === "string") {
      return obj.rewrite.slice(0, 120) + (obj.rewrite.length > 120 ? "..." : "");
    }

    if (obj.questions && Array.isArray(obj.questions)) {
      return `共 ${obj.questions.length} 个问题`;
    }

    if (obj.title && typeof obj.title === "string") {
      return obj.title;
    }

    const firstStringValue = Object.values(obj).find((v) => typeof v === "string" && v.length > 0);

    if (firstStringValue) {
      return (firstStringValue as string).slice(0, 120);
    }
  }

  return JSON.stringify(content).slice(0, 120) + "...";
}

export function HistoryWorkspace({
  projects,
  selectedProjectId,
  allProjectCount,
  cards,
  selectedCardId,
  jdRecords,
  selectedJdId,
  initialVersions
}: HistoryWorkspaceProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionItem[]>(initialVersions);
  const [isLoading, startLoading] = useTransition();
  const [isRestoring, startRestoring] = useTransition();
  const [selectedVersion, setSelectedVersion] = useState<VersionItem | null>(null);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreError, setRestoreError] = useState("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    setVersions(initialVersions);
    setSelectedVersion(null);
    setRestoreMessage("");
    setRestoreError("");
  }, [initialVersions, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/history?projectId=${projectId}`);
  };

  const handleCardChange = (cardId: string) => {
    if (!selectedProjectId) {
      return;
    }
    router.push(
      `/history?projectId=${selectedProjectId}&cardId=${cardId}${selectedJdId ? `&jdId=${selectedJdId}` : ""}`
    );
  };

  const handleJdChange = (jdId: string) => {
    if (!selectedProjectId) {
      return;
    }
    router.push(
      `/history?projectId=${selectedProjectId}${selectedCardId ? `&cardId=${selectedCardId}` : ""}&jdId=${jdId}`
    );
  };

  const handleClearCrossFilter = () => {
    if (!selectedProjectId) {
      return;
    }
    router.push(`/history?projectId=${selectedProjectId}`);
  };

  const handleViewDetail = (version: VersionItem) => {
    setSelectedVersion(version);
    setRestoreMessage("");
    setRestoreError("");
  };

  const handleRestore = (version: VersionItem) => {
    setRestoreError("");
    setRestoreMessage("");

    startRestoring(async () => {
      const result = await restoreVersionAction(version.id);

      if (!result.success) {
        setRestoreError(result.message);
        return;
      }

      setRestoreMessage(result.message);

      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
    });
  };

  if (projects.length === 0) {
    return (
      <section className="page-card p-6 sm:p-8">
        <span className="soft-chip">历史版本</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">历史版本</h1>
        <div className="mt-6">
          <EmptyState
            icon={
              <svg className="h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title={allProjectCount > 0 ? "还没有 AI 产物版本" : "还没有求职计划"}
            description={
              allProjectCount > 0
                ? "你已有求职计划，但还没有 AI 产物。完成项目卡片确认、JD 匹配分析或简历改写后，AI 产出的内容会自动存档到历史版本。"
                : "创建求职计划并录入素材后，完成项目卡片、匹配分析或简历改写，AI 产物会自动存档在这里。"
            }
            action={{
              label: allProjectCount > 0 ? "前往 JD 分析页" : "前往工作台",
              href: allProjectCount > 0 ? "/jd-analysis" : "/workspace"
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="soft-chip">版本时间线</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">历史版本</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              项目卡片版本、匹配分析版本和输出版本的统一时间线。可以查看历史快照，也可以恢复到当前编辑区继续使用。
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-4 text-sm shadow-sm xl:w-[320px]">
            <div className="text-xs text-slate-500">当前选中求职计划</div>
            <div className="mt-2 font-medium text-slate-900">{selectedProject?.name ?? "未选择求职计划"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">版本数量：{selectedProject?.versionCount ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="section-title">选择要查看的求职计划</h2>
            <p className="section-copy mt-2">只显示有版本记录的求职计划。</p>
          </div>
          <select
            value={selectedProjectId ?? ""}
            onChange={(event) => handleProjectChange(event.target.value)}
            className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:max-w-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.targetRole}（{project.versionCount} 个版本）
              </option>
            ))}
          </select>
        </div>

        {/* 交叉点筛选：卡片 × JD */}
        {(cards.length > 0 || jdRecords.length > 0) && selectedProjectId ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-sky-100 pt-5 lg:flex-row lg:items-center">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">按交叉点筛选</div>
            <select
              value={selectedCardId ?? ""}
              onChange={(event) => handleCardChange(event.target.value)}
              className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:w-56"
            >
              <option value="">全部卡片</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  卡片：{card.title}
                </option>
              ))}
            </select>
            <select
              value={selectedJdId ?? ""}
              onChange={(event) => handleJdChange(event.target.value)}
              className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:w-44"
            >
              <option value="">全部 JD</option>
              {jdRecords.map((jd) => (
                <option key={jd.id} value={jd.id}>
                  {jd.title}
                </option>
              ))}
            </select>
            {selectedCardId || selectedJdId ? (
              <button
                type="button"
                onClick={handleClearCrossFilter}
                className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-medium text-sky-700 transition hover:border-sky-300"
              >
                清除筛选
              </button>
            ) : null}
            <p className="text-xs leading-6 text-slate-400">
              同时选择卡片与 JD 时，只显示该组合下的版本。
            </p>
          </div>
        ) : null}
      </section>

      {restoreError ? <ErrorDisplay error={restoreError} compact /> : null}
      {restoreMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{restoreMessage}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="page-card p-6 sm:p-8">
          <div className="border-b border-sky-100 pb-5">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">版本时间线</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              按时间倒序展示所有版本记录，点击&ldquo;查看详情&rdquo;可在右侧预览内容。
            </p>
          </div>

          {isLoading ? (
            <div className="mt-6 text-sm text-slate-500">正在加载版本记录...</div>
          ) : versions.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">
              当前项目还没有版本记录。完成项目卡片确认、匹配分析保存、简历改写或面试准备后，版本会自动出现。
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {versions.map((version) => {
                const config = typeConfig[version.type] ?? { label: version.type, color: "bg-slate-100 text-slate-800" };
                const isSelected = selectedVersion?.id === version.id;

                return (
                  <article
                    key={version.id}
                    className={`rounded-[20px] border p-5 transition cursor-pointer ${
                      isSelected
                        ? "border-sky-300 bg-sky-50/90 shadow-sm"
                        : "border-sky-100 bg-white/90 hover:border-sky-200"
                    }`}
                    onClick={() => handleViewDetail(version)}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {version.sourceProjectCardId && version.jdRecordId ? (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                            卡片 × JD 交叉产物
                          </span>
                        ) : null}
                        <span className="text-sm text-slate-500">{formatRelativeTime(version.createdAt)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetail(version);
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-300"
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(version);
                          }}
                          disabled={isRestoring}
                          className="inline-flex items-center justify-center rounded-full bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
                        >
                          恢复此版本
                        </button>
                      </div>
                    </div>
                    <h3 className="mt-3 text-sm font-medium text-slate-900">{version.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-slate-500">
                      {formatDateTime(version.createdAt)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-2">
                      {getContentPreview(version.content)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="page-card h-fit p-6 sm:p-8 xl:sticky xl:top-24">
          <div className="border-b border-sky-100 pb-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">版本详情</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {selectedVersion ? "查看选中版本的完整内容。" : "点击左侧时间线中的版本查看详情。"}
            </p>
          </div>

          {!selectedVersion ? (
            <div className="mt-6 rounded-[20px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">
              还没有选中任何版本。点击左侧时间线中的版本记录，这里会展示详情内容。
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">版本标题</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{selectedVersion.title}</div>
              </div>
              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">版本类型</div>
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${typeConfig[selectedVersion.type]?.color ?? "bg-slate-100 text-slate-800"}`}>
                    {typeConfig[selectedVersion.type]?.label ?? selectedVersion.type}
                  </span>
                </div>
              </div>
              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">保存时间</div>
                <div className="mt-2 text-sm text-slate-700">{formatDateTime(selectedVersion.createdAt)}</div>
              </div>
              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">内容预览</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700 max-h-[400px] overflow-y-auto">
                  {(() => {
                    const content = selectedVersion.content;
                    if (!content) return "无内容";

                    if (typeof content === "string") return content;

                    if (typeof content === "object") {
                      const obj = content as Record<string, unknown>;
                      const parts: string[] = [];

                      if (obj.script) parts.push(`讲稿：\n${obj.script}`);
                      if (obj.rewrite) parts.push(`改写稿：\n${obj.rewrite}`);
                      if (obj.reasoning) parts.push(`思路：\n${obj.reasoning}`);
                      if (obj.highlights && Array.isArray(obj.highlights)) parts.push(`重点：\n${(obj.highlights as string[]).join("\n")}`);
                      if (obj.questions && Array.isArray(obj.questions)) parts.push(`问题列表：\n${(obj.questions as string[]).join("\n")}`);
                      if (obj.background) parts.push(`背景：\n${obj.background}`);
                      if (obj.responsibility) parts.push(`职责：\n${obj.responsibility}`);
                      if (obj.result) parts.push(`结果：\n${obj.result}`);
                      if (obj.matchedPoints && Array.isArray(obj.matchedPoints)) parts.push(`匹配点：\n${(obj.matchedPoints as string[]).join("\n")}`);
                      if (obj.gapPoints && Array.isArray(obj.gapPoints)) parts.push(`差距点：\n${(obj.gapPoints as string[]).join("\n")}`);
                      if (obj.suggestionPoints && Array.isArray(obj.suggestionPoints)) parts.push(`建议：\n${(obj.suggestionPoints as string[]).join("\n")}`);

                      if (parts.length > 0) return parts.join("\n\n");

                      return JSON.stringify(content, null, 2);
                    }

                    return String(content);
                  })()}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRestore(selectedVersion)}
                disabled={isRestoring}
                className="w-full inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(83,74,183,0.9)] transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-primary-300"
              >
                {isRestoring ? "正在恢复..." : "恢复此版本到当前编辑区"}
              </button>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
