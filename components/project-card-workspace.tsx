"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateProjectCardDraftAction,
  saveProjectCardVersionAction,
  updateProjectCardAction
} from "@/app/project-card/actions";
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
  versions
}: ProjectCardWorkspaceProps) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isSavingCard, startSavingCard] = useTransition();
  const [isSavingVersion, startSavingVersion] = useTransition();
  const [generateMessage, setGenerateMessage] = useState(
    initialCard ? "当前项目已有一份项目卡片草稿，可以继续确认和修改。" : "先生成项目卡片草稿，再进行事实确认。"
  );
  const [generateError, setGenerateError] = useState("");
  const [responseModel, setResponseModel] = useState("");
  const [saveMessage, setSaveMessage] = useState(
    initialCard ? "当前卡片已加载，可以直接修改后保存。" : "当前还没有项目卡片草稿。"
  );
  const [saveError, setSaveError] = useState("");
  const [versionMessage, setVersionMessage] = useState(
    versions.length > 0 ? "下方展示的是已保存的项目卡片版本。" : "当前还没有保存过项目卡片版本。"
  );
  const [versionError, setVersionError] = useState("");
  const [formValues, setFormValues] = useState<ProjectCardData | null>(initialCard);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    setFormValues(initialCard);
    setGenerateError("");
    setSaveError("");
    setVersionError("");
    setResponseModel("");
    setGenerateMessage(
      initialCard ? "当前项目已有一份项目卡片草稿，可以继续确认和修改。" : "先生成项目卡片草稿，再进行事实确认。"
    );
    setSaveMessage(initialCard ? "当前卡片已加载，可以直接修改后保存。" : "当前还没有项目卡片草稿。");
    setVersionMessage(versions.length > 0 ? "下方展示的是已保存的项目卡片版本。" : "当前还没有保存过项目卡片版本。");
  }, [initialCard, versions]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/project-card?projectId=${projectId}`);
  };

  const handleFieldChange = <K extends keyof ProjectCardData>(field: K, value: ProjectCardData[K]) => {
    setFormValues((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleGenerateCard = () => {
    if (!selectedProjectId) {
      return;
    }

    setGenerateError("");

    startGenerating(async () => {
      const result = await generateProjectCardDraftAction(selectedProjectId);

      if (!result.success) {
        setGenerateError(result.message);
        return;
      }

      setGenerateMessage(result.message);
      setResponseModel(result.model ?? "");
      router.refresh();
    });
  };

  const handleSaveCard = () => {
    if (!selectedProjectId || !formValues) {
      return;
    }

    setSaveError("");

    startSavingCard(async () => {
      const result = await updateProjectCardAction({
        projectId: selectedProjectId,
        cardId: formValues.id,
        title: formValues.title,
        background: formValues.background,
        backgroundFactStatus: formValues.backgroundFactStatus,
        responsibility: formValues.responsibility,
        responsibilityFactStatus: formValues.responsibilityFactStatus,
        result: formValues.result,
        resultFactStatus: formValues.resultFactStatus,
        status: formValues.status
      });

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSaveMessage(result.message);
      router.refresh();
    });
  };

  const handleSaveVersion = () => {
    if (!selectedProjectId) {
      return;
    }

    setVersionError("");

    startSavingVersion(async () => {
      const result = await saveProjectCardVersionAction(selectedProjectId);

      if (!result.success) {
        setVersionError(result.message);
        return;
      }

      setVersionMessage(result.message);
      router.refresh();
    });
  };

  if (projects.length === 0) {
    return (
      <section className="page-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">项目卡片</h1>
        <p className="mt-2 text-sm text-slate-500">结构化整理项目信息</p>
        <div className="mt-6">
          <EmptyState
            icon={
              <svg className="h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
            title="还没有项目"
            description="创建项目并录入项目材料后，才能生成结构化的项目卡片草稿。"
            action={{
              label: "前往工作台创建项目",
              href: "/workspace"
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">项目卡片</h1>
        <p className="mt-2 text-sm text-slate-500">
          把项目材料整理成结构化卡片，确认关键事实后可用于 JD 分析和简历改写。
        </p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">当前项目</div>
          <div className="mt-1 font-medium text-slate-900">{selectedProject?.name ?? "未选择"}</div>
          <div className="mt-1 text-sm text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
        </div>
      </section>

      <section className="page-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">选择项目</h2>
            <p className="mt-1 text-sm text-slate-500">不同项目有独立的卡片和版本记录。</p>
          </div>
          <select value={selectedProjectId ?? ""} onChange={(event) => handleProjectChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 lg:w-64">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.targetRole}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!projectMaterialExists ? (
        <section className="page-card p-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            当前项目还没有原始材料，无法生成项目卡片。请先到项目材料页录入内容。
          </div>
          <Link href={selectedProjectId ? `/project-materials?projectId=${selectedProjectId}` : "/project-materials"} className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            前往项目材料页
          </Link>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="page-card p-5">
            <h3 className="font-semibold text-slate-900">生成草稿</h3>
            <p className="mt-3 text-sm text-slate-600">{generateMessage}</p>
            {responseModel ? <div className="mt-2 text-xs text-slate-500">模型：{responseModel}</div> : null}
            {generateError ? <ErrorDisplay error={generateError} compact /> : null}
            <button type="button" onClick={handleGenerateCard} disabled={isGenerating || !selectedProjectId} className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isGenerating ? "生成中..." : "生成项目卡片草稿"}
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
                {versions.slice(0, 4).map((version) => (
                  <div key={version.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                    <div className="font-medium text-slate-900">{version.title}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(version.createdAt)}</div>
                  </div>
                ))}
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
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">项目卡片草稿</h2>
                    <p className="mt-1 text-sm text-slate-500">查看并确认结构化内容</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {cardStatusOptions.find((item) => item.value === formValues.status)?.label}
                  </span>
                </div>

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

                  {saveError ? <ErrorDisplay error={saveError} compact /> : null}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-500">{saveMessage}</p>
                    <button type="button" onClick={handleSaveCard} disabled={isSavingCard} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                      {isSavingCard ? "保存中..." : "保存卡片"}
                    </button>
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
