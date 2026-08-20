"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateProjectCardDraftAction,
  getProjectCardVersionDetailAction,
  saveProjectCardVersionAction,
  setCurrentProjectCardAction
} from "@/app/project-card/actions";
import { deleteVersionAction } from "@/app/history/actions";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft-storage";
import { GeneratingIndicator } from "@/components/generating-indicator";

function draftCardKey(projectId: string | null, cardId: string | null) {
  // 草稿按卡片隔离：有 cardId 时用卡片维度，避免从卡片库进入时串到其他卡片的草稿
  return `jd-helper:draft:card:${cardId ?? projectId ?? "none"}`;
}
import { EmptyState } from "@/components/empty-state";
import { ErrorDisplay } from "@/components/error-display";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
};

type FactStatus = "CONFIRMED" | "NEEDS_CONFIRMATION" | "EXPRESSION_SUGGESTION";
type CardStatus = "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED";

type ProjectCardData = {
  id: string;
  title: string;
  background: string;
  backgroundFactStatus: FactStatus;
  responsibility: string;
  responsibilityFactStatus: FactStatus;
  result: string;
  resultFactStatus: FactStatus;
  status: CardStatus;
  isCurrentProjectCard?: boolean;
  updatedAt: string;
};

type VersionItem = {
  id: string;
  title: string;
  createdAt: string;
};

type ProjectCardWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  initialCard: ProjectCardData | null;
  projectMaterialExists: boolean;
  questionAnswerCount: number;
  versions: VersionItem[];
  resumes?: Array<{ id: string; title: string; updatedAt: string }>;
  materials?: Array<{ id: string; title: string; updatedAt: string }>;
};

const factStatusOptions = [
  { value: "CONFIRMED", label: "已确认事实" },
  { value: "NEEDS_CONFIRMATION", label: "待确认推断" },
  { value: "EXPRESSION_SUGGESTION", label: "表达建议" }
] as const;

const cardStatusOptions = [
  { value: "DRAFT", label: "草稿" },
  { value: "PENDING_CONFIRMATION", label: "待确认" },
  { value: "CONFIRMED", label: "已确认" }
] as const;

const editableSections: Array<{
  field: "background" | "responsibility" | "result";
  statusField: "backgroundFactStatus" | "responsibilityFactStatus" | "resultFactStatus";
  label: string;
}> = [
  { field: "background", statusField: "backgroundFactStatus", label: "项目背景" },
  { field: "responsibility", statusField: "responsibilityFactStatus", label: "核心职责" },
  { field: "result", statusField: "resultFactStatus", label: "项目结果" }
];

const factStatusMeta = {
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NEEDS_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-700",
  EXPRESSION_SUGGESTION: "border-sky-200 bg-sky-50 text-sky-700"
} as const;

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ProjectCardWorkspace({
  projects,
  selectedProjectId,
  initialCard,
  projectMaterialExists,
  questionAnswerCount,
  versions,
  resumes = [],
  materials = []
}: ProjectCardWorkspaceProps) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isSavingVersion, startSavingVersion] = useTransition();
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id ?? "");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(materials.slice(0, 2).map((item) => item.id));
  const [generateMessage, setGenerateMessage] = useState(
    initialCard ? "当前卡片已有草稿，可以继续确认和修改。" : "先生成项目卡片草稿，再进行事实确认。"
  );
  const [generateError, setGenerateError] = useState("");
  const [responseModel, setResponseModel] = useState("");
  const [versionMessage, setVersionMessage] = useState(
    versions.length > 0 ? "下方展示的是已保存的项目卡片版本，点击可查看当时内容。" : "当前还没有保存过项目卡片版本。"
  );
  const [versionError, setVersionError] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<{ id: string; title: string; createdAt: string; content: unknown } | null>(null);
  const [isLoadingVersion, startLoadingVersion] = useTransition();
  const [isSettingCurrent, startSettingCurrent] = useTransition();
  const [currentMessage, setCurrentMessage] = useState("");
  const [formValues, setFormValues] = useState<ProjectCardData | null>(initialCard);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    // 优先恢复本地未保存的卡片编辑草稿，否则用服务端数据
    const savedCard = loadDraft<ProjectCardData>(draftCardKey(selectedProjectId, initialCard?.id ?? null));
    setFormValues(savedCard ?? initialCard);
    setGenerateError("");
    setVersionError("");
    setResponseModel("");
    setGenerateMessage(
      initialCard ? "当前卡片已有草稿，可以继续确认和修改。" : "先生成项目卡片草稿，再进行事实确认。"
    );
    setVersionMessage(versions.length > 0 ? "下方展示的是已保存的项目卡片版本，点击可查看当时内容。" : "当前还没有保存过项目卡片版本。");
  }, [initialCard, versions, selectedProjectId]);

  // 卡片内容变化时自动暂存（编辑不丢失）
  useEffect(() => {
    if (formValues) {
      saveDraft(draftCardKey(selectedProjectId, formValues.id), formValues);
    }
  }, [formValues, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/project-card?projectId=${projectId}`);
  };

  const handleFieldChange = <K extends keyof ProjectCardData>(field: K, value: ProjectCardData[K]) => {
    setFormValues((current) => {
      if (!current) {
        return current;
      }

      const next: ProjectCardData = { ...current, [field]: value };

      // 内容字段被修改时，自动把对应事实状态置回「待确认」，避免"改了内容却没确认"
      const contentFieldToStatus: Record<string, "backgroundFactStatus" | "responsibilityFactStatus" | "resultFactStatus"> = {
        background: "backgroundFactStatus",
        responsibility: "responsibilityFactStatus",
        result: "resultFactStatus"
      };
      const statusField = contentFieldToStatus[field];

      if (statusField && typeof value === "string" && value !== (initialCard?.[field] as string | undefined)) {
        next[statusField] = "NEEDS_CONFIRMATION";
      }

      return next;
    });
  };

  const handleGenerateCard = (regenerate: boolean = false) => {
    setGenerateError("");

    startGenerating(async () => {
      // 基于确认内容重新生成时，把已确认字段作为事实基线传给模型
      const confirmedFields = regenerate && formValues
        ? {
            title: formValues.title,
            background: formValues.background,
            responsibility: formValues.responsibility,
            result: formValues.result
          }
        : undefined;

      const result = await generateProjectCardDraftAction(selectedProjectId, {
        resumeMaterialId: selectedResumeId || undefined,
        projectMaterialIds: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        confirmedFields
      });

      if (!result.success) {
        setGenerateError(result.message);
        return;
      }

      setGenerateMessage(result.message);
      setResponseModel(result.model ?? "");
      router.refresh();
    });
  };

  const handleSaveVersion = () => {
    if (!formValues) {
      return;
    }

    setVersionError("");

    startSavingVersion(async () => {
      // 用前端当前编辑内容保存版本：先落草稿，再生成快照，保证版本 = 此刻看到的卡片
      const result = await saveProjectCardVersionAction(selectedProjectId, {
        cardId: formValues.id,
        content: {
          title: formValues.title,
          background: formValues.background,
          backgroundFactStatus: formValues.backgroundFactStatus,
          responsibility: formValues.responsibility,
          responsibilityFactStatus: formValues.responsibilityFactStatus,
          result: formValues.result,
          resultFactStatus: formValues.resultFactStatus,
          status: formValues.status
        }
      });

      if (!result.success) {
        setVersionError(result.message);
        return;
      }

      setVersionMessage(result.message);
      // 已保存为版本，清除本地草稿
      clearDraft(draftCardKey(selectedProjectId, formValues.id));
      router.refresh();
    });
  };

  const handleViewVersion = (versionId: string) => {
    setVersionError("");

    startLoadingVersion(async () => {
      const result = await getProjectCardVersionDetailAction(versionId);

      if (!result.success) {
        setVersionError(result.message);
        return;
      }

      setSelectedVersion({
        id: versionId,
        title: result.title,
        createdAt: result.createdAt,
        content: result.content
      });
    });
  };

  const handleDeleteVersion = (versionId: string) => {
    if (!window.confirm("确定删除该版本？删除后不可恢复。")) {
      return;
    }

    setVersionError("");

    startSavingVersion(async () => {
      const result = await deleteVersionAction(versionId);

      if (!result.success) {
        setVersionError(result.message);
        return;
      }

      if (selectedVersion?.id === versionId) {
        setSelectedVersion(null);
      }

      setVersionMessage(result.message);
      router.refresh();
    });
  };

  const handleSetCurrent = () => {
    if (!formValues) {
      return;
    }

    setCurrentMessage("");

    startSettingCurrent(async () => {
      const result = await setCurrentProjectCardAction(formValues.id, selectedProjectId);

      if (!result.success) {
        setCurrentMessage(result.message);
        return;
      }

      setCurrentMessage(result.message);
      router.refresh();
    });
  };

  return (
    <>
      <section className="page-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">项目卡片</h1>
        <p className="mt-2 text-sm text-slate-500">
          把项目经历素材自由组合成结构化卡片，确认关键事实后可用于 JD 分析和简历改写。卡片不需要先创建求职计划。
        </p>

        {projects.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            还没有求职计划也不影响建卡片——直接在下方选择简历和项目经历组合生成即可。也可以先到项目经历页录入素材。
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">关联求职计划（可选）</div>
            <div className="mt-1 font-medium text-slate-900">{selectedProject?.name ?? "未选择"}</div>
            <div className="mt-1 text-sm text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
          </div>
        )}
      </section>

      {projects.length > 0 ? (
        <section className="page-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">选择求职计划（可选）</h2>
              <p className="mt-1 text-sm text-slate-500">不选也能生成卡片，卡片可随时关联到求职计划。</p>
            </div>
            <select value={selectedProjectId ?? ""} onChange={(event) => handleProjectChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 lg:w-64">
              <option value="">不关联求职计划</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {project.targetRole}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {selectedProjectId && !projectMaterialExists ? (
        <section className="page-card p-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            当前求职计划下还没有项目材料。你可以在下方直接勾选项目经历素材来生成卡片，不依赖计划内材料。
          </div>
          <Link href="/project-materials" className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            前往项目经历页
          </Link>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="page-card p-5">
            <h3 className="font-semibold text-slate-900">生成草稿</h3>
            <p className="mt-3 text-sm text-slate-600">{generateMessage}</p>
            {responseModel ? <div className="mt-2 text-xs text-slate-500">模型：{responseModel}</div> : null}
            {generateError ? <ErrorDisplay error={generateError} compact /> : null}
            {isGenerating ? <GeneratingIndicator label="AI 正在生成项目卡片草稿" /> : null}

            {/* 组合选择：简历 + 多份项目经历 */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">选择简历（可选）</label>
                <select
                  value={selectedResumeId}
                  onChange={(event) => setSelectedResumeId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-300"
                >
                  <option value="">不关联简历</option>
                  {resumes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {formatDateTime(item.updatedAt)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">选择项目经历（可多选）</label>
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {materials.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-slate-400">还没有项目经历，可先到项目材料页录入。</p>
                  ) : (
                    materials.map((item) => {
                      const checked = selectedMaterialIds.includes(item.id);
                      return (
                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedMaterialIds((current) =>
                                checked ? current.filter((id) => id !== item.id) : [...current, item.id]
                              );
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                          />
                          <span className="truncate">{item.title}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <button type="button" onClick={() => handleGenerateCard(false)} disabled={isGenerating || selectedMaterialIds.length === 0} className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isGenerating ? "生成中..." : "生成项目卡片草稿"}
            </button>
            <button type="button" onClick={() => handleGenerateCard(true)} disabled={isGenerating || !formValues || selectedMaterialIds.length === 0} className="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-slate-400">
              {isGenerating ? "重新生成中..." : "基于当前确认内容重新生成"}
            </button>
          </div>

          <div className="page-card p-5">
            <h3 className="font-semibold text-slate-900">版本记录</h3>
            <p className="mt-3 text-sm text-slate-600">{versionMessage}</p>
            {versionError ? <ErrorDisplay error={versionError} compact /> : null}
            <button type="button" onClick={handleSaveVersion} disabled={isSavingVersion || !formValues} className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-400">
              {isSavingVersion ? "保存中..." : "保存版本"}
            </button>

            {versions.length > 0 ? (
              <div className="mt-5 space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewVersion(version.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        handleViewVersion(version.id);
                      }
                    }}
                    className={`cursor-pointer rounded-2xl px-4 py-3 text-sm leading-7 transition ${
                      selectedVersion?.id === version.id
                        ? "border border-sky-300 bg-sky-50"
                        : "bg-slate-50 hover:border hover:border-sky-200 hover:bg-sky-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">{version.title}</div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-sky-600">查看</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteVersion(version.id);
                          }}
                          className="text-xs text-red-500 transition hover:text-red-700"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{formatDateTime(version.createdAt)}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {isLoadingVersion ? (
              <div className="mt-4 text-xs text-slate-500">正在加载版本详情...</div>
            ) : null}

            {selectedVersion ? (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-500">版本详情</div>
                  <button
                    type="button"
                    onClick={() => setSelectedVersion(null)}
                    className="rounded-full px-2 py-0.5 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    收起
                  </button>
                </div>
                <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto">
                  {(() => {
                    const content = selectedVersion.content as {
                      title?: string;
                      background?: string;
                      backgroundFactStatus?: string;
                      responsibility?: string;
                      responsibilityFactStatus?: string;
                      result?: string;
                      resultFactStatus?: string;
                      status?: string;
                    } | null;

                    if (!content || typeof content !== "object") {
                      return <div className="text-xs leading-6 text-slate-500">无内容</div>;
                    }

                    const sections: Array<{ label: string; value: string }> = [
                      { label: "项目卡片标题", value: content.title ?? "（空）" },
                      { label: "项目背景", value: content.background ?? "（空）" },
                      { label: "核心职责", value: content.responsibility ?? "（空）" },
                      { label: "项目结果", value: content.result ?? "（空）" },
                      { label: "卡片状态", value: content.status ?? "（空）" }
                    ];

                    return sections.map((section) => (
                      <div key={section.label} className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{section.label}</div>
                        <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{section.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          {!formValues ? (
            <section className="page-card p-6 sm:p-8">
              <h2 className="section-title">当前还没有项目卡片草稿</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                先点击左侧“生成项目卡片草稿”。系统会根据项目材料和问答记录产出一版结构化卡片，并默认把核心字段标记为“待确认推断”。
              </p>
            </section>
          ) : (
            <>
              <section className="page-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">项目卡片草稿</h2>
                    <p className="mt-1 text-sm text-slate-500">查看并确认结构化内容</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {formValues.isCurrentProjectCard ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">当前最终版本</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSetCurrent}
                        disabled={isSettingCurrent}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSettingCurrent ? "设置中..." : "设为当前最终版本"}
                      </button>
                    )}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {cardStatusOptions.find((item) => item.value === formValues.status)?.label}
                    </span>
                  </div>
                </div>
                {currentMessage ? <div className="mt-3 text-xs leading-6 text-slate-500">{currentMessage}</div> : null}

                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">项目卡片标题</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{formValues.title}</div>
                  </div>

                  {[
                    { key: "background", title: "项目背景", value: formValues.background, status: formValues.backgroundFactStatus },
                    { key: "responsibility", title: "核心职责", value: formValues.responsibility, status: formValues.responsibilityFactStatus },
                    { key: "result", title: "项目结果", value: formValues.result, status: formValues.resultFactStatus }
                  ].map((section) => (
                    <article key={section.key} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium text-slate-900">{section.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${factStatusMeta[section.status]}`}>
                          {factStatusOptions.find((item) => item.value === section.status)?.label}
                        </span>
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{section.value}</div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="page-card p-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="font-semibold text-slate-900">确认并修改关键字段</h2>
                  <p className="mt-1 text-sm text-slate-500">直接修改内容，标记确认状态。</p>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-medium text-slate-700">项目卡片标题</label>
                    <input value={formValues.title} onChange={(event) => handleFieldChange("title", event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400" />
                  </div>

                  {editableSections.map((section) => (
                    <div key={section.field} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-slate-700">{section.label}</label>
                        <select
                          value={formValues[section.statusField]}
                          onChange={(event) => handleFieldChange(section.statusField, event.target.value as ProjectCardData[typeof section.statusField])}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
                        >
                          {factStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        value={formValues[section.field]}
                        onChange={(event) => handleFieldChange(section.field, event.target.value as ProjectCardData[typeof section.field])}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                  ))}

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-slate-700">卡片状态</label>
                      <select
                        value={formValues.status}
                        onChange={(event) => handleFieldChange("status", event.target.value as never)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-slate-400"
                      >
                        {cardStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-500">修改会自动暂存在本地；确认无误后，点击左侧「保存版本」生成历史快照。</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </>
  );
}
