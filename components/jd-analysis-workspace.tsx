"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateCapabilitySummaryAction,
  generateMatchAnalysisAction,
  saveJdRecordAction,
  saveMatchAnalysisVersionAction,
  updateMatchAnalysisAction
} from "@/app/jd-analysis/actions";
import { EmptyState } from "@/components/empty-state";
import { ErrorDisplay } from "@/components/error-display";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
};

type CapabilitySummary = {
  responsibilities: string[];
  capabilities: string[];
  priorities: Array<{ label: string; level: string }>;
};

type MatchAnalysisData = {
  id: string;
  matchedPoints: string[];
  gapPoints: string[];
  suggestionPoints: string[];
  plainExplanations: {
    matchedPoints: string;
    gapPoints: string;
    suggestionPoints: string;
  };
  summary: string;
  status: "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED";
  updatedAt: string;
};

type VersionItem = {
  id: string;
  title: string;
  createdAt: string;
};

type JdAnalysisWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  initialJdText: string;
  jdSavedAt: string | null;
  projectCardExists: boolean;
  capabilitySummary: CapabilitySummary | null;
  matchAnalysis: MatchAnalysisData | null;
  versions: VersionItem[];
};

const matchStatusOptions = [
  { value: "DRAFT", label: "草稿" },
  { value: "PENDING_CONFIRMATION", label: "待确认" },
  { value: "CONFIRMED", label: "已确认" }
] as const;

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

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function JdAnalysisWorkspace({
  projects,
  selectedProjectId,
  initialJdText,
  jdSavedAt,
  projectCardExists,
  capabilitySummary,
  matchAnalysis,
  versions
}: JdAnalysisWorkspaceProps) {
  const router = useRouter();
  const [isSavingJd, startSavingJd] = useTransition();
  const [isGeneratingSummary, startGeneratingSummary] = useTransition();
  const [isGeneratingAnalysis, startGeneratingAnalysis] = useTransition();
  const [isSavingAnalysis, startSavingAnalysis] = useTransition();
  const [isSavingVersion, startSavingVersion] = useTransition();
  const [jdText, setJdText] = useState(initialJdText);
  const [jdMessage, setJdMessage] = useState(initialJdText ? "当前项目已保存一份 JD 原文，可以继续编辑后覆盖保存。" : "先粘贴目标 JD，再生成岗位能力摘要和匹配分析。");
  const [jdError, setJdError] = useState("");
  const [summaryMessage, setSummaryMessage] = useState(capabilitySummary ? "当前项目已有岗位能力摘要，可以继续重新生成。" : "还没有岗位能力摘要。先保存 JD，再点击“解析 JD”。");
  const [summaryError, setSummaryError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState(matchAnalysis ? "当前项目已有匹配分析草稿，可以继续确认表达重点。" : "还没有匹配分析草稿。先生成 JD 摘要，再开始匹配分析。");
  const [analysisError, setAnalysisError] = useState("");
  const [versionMessage, setVersionMessage] = useState(versions.length > 0 ? "下方展示的是已保存的匹配分析版本。" : "当前还没有保存过匹配分析版本。");
  const [versionError, setVersionError] = useState("");
  const [responseModel, setResponseModel] = useState("");
  const [latestJdSavedAt, setLatestJdSavedAt] = useState<string | null>(jdSavedAt);
  const [analysisForm, setAnalysisForm] = useState(
    matchAnalysis
      ? {
          id: matchAnalysis.id,
          matchedPoints: joinLines(matchAnalysis.matchedPoints),
          gapPoints: joinLines(matchAnalysis.gapPoints),
          suggestionPoints: joinLines(matchAnalysis.suggestionPoints),
          plainMatchedPoints: matchAnalysis.plainExplanations.matchedPoints,
          plainGapPoints: matchAnalysis.plainExplanations.gapPoints,
          plainSuggestionPoints: matchAnalysis.plainExplanations.suggestionPoints,
          summary: matchAnalysis.summary,
          status: matchAnalysis.status
        }
      : null
  );
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    setJdText(initialJdText);
    setLatestJdSavedAt(jdSavedAt);
    setJdError("");
    setSummaryError("");
    setAnalysisError("");
    setVersionError("");
    setResponseModel("");
    setJdMessage(initialJdText ? "当前项目已保存一份 JD 原文，可以继续编辑后覆盖保存。" : "先粘贴目标 JD，再生成岗位能力摘要和匹配分析。");
    setSummaryMessage(capabilitySummary ? "当前项目已有岗位能力摘要，可以继续重新生成。" : "还没有岗位能力摘要。先保存 JD，再点击“解析 JD”。");
    setAnalysisMessage(matchAnalysis ? "当前项目已有匹配分析草稿，可以继续确认表达重点。" : "还没有匹配分析草稿。先生成 JD 摘要，再开始匹配分析。");
    setVersionMessage(versions.length > 0 ? "下方展示的是已保存的匹配分析版本。" : "当前还没有保存过匹配分析版本。");
    setAnalysisForm(
      matchAnalysis
        ? {
            id: matchAnalysis.id,
            matchedPoints: joinLines(matchAnalysis.matchedPoints),
            gapPoints: joinLines(matchAnalysis.gapPoints),
            suggestionPoints: joinLines(matchAnalysis.suggestionPoints),
            plainMatchedPoints: matchAnalysis.plainExplanations.matchedPoints,
            plainGapPoints: matchAnalysis.plainExplanations.gapPoints,
            plainSuggestionPoints: matchAnalysis.plainExplanations.suggestionPoints,
            summary: matchAnalysis.summary,
            status: matchAnalysis.status
          }
        : null
    );
  }, [capabilitySummary, initialJdText, jdSavedAt, matchAnalysis, selectedProjectId, versions]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/jd-analysis?projectId=${projectId}`);
  };

  const handleSaveJd = () => {
    if (!selectedProjectId) {
      return;
    }

    setJdError("");

    startSavingJd(async () => {
      const result = await saveJdRecordAction(selectedProjectId, jdText);

      if (!result.success) {
        setJdError(result.message);
        return;
      }

      setJdMessage(result.message);
      setLatestJdSavedAt(result.savedAt ?? new Date().toISOString());
      router.refresh();
    });
  };

  const handleGenerateSummary = () => {
    if (!selectedProjectId) {
      return;
    }

    setSummaryError("");

    startGeneratingSummary(async () => {
      const result = await generateCapabilitySummaryAction(selectedProjectId);

      if (!result.success) {
        setSummaryError(result.message);
        return;
      }

      setSummaryMessage(result.message);
      setResponseModel(result.model ?? "");
      router.refresh();
    });
  };

  const handleGenerateAnalysis = () => {
    if (!selectedProjectId) {
      return;
    }

    setAnalysisError("");

    startGeneratingAnalysis(async () => {
      const result = await generateMatchAnalysisAction(selectedProjectId);

      if (!result.success) {
        setAnalysisError(result.message);
        return;
      }

      setAnalysisMessage(result.message);
      setResponseModel(result.model ?? "");
      router.refresh();
    });
  };

  const handleSaveAnalysis = () => {
    if (!selectedProjectId || !analysisForm) {
      return;
    }

    setAnalysisError("");

    startSavingAnalysis(async () => {
      const result = await updateMatchAnalysisAction({
        projectId: selectedProjectId,
        matchAnalysisId: analysisForm.id,
        matchedPoints: splitLines(analysisForm.matchedPoints),
        gapPoints: splitLines(analysisForm.gapPoints),
        suggestionPoints: splitLines(analysisForm.suggestionPoints),
        plainMatchedPoints: analysisForm.plainMatchedPoints,
        plainGapPoints: analysisForm.plainGapPoints,
        plainSuggestionPoints: analysisForm.plainSuggestionPoints,
        summary: analysisForm.summary,
        status: analysisForm.status
      });

      if (!result.success) {
        setAnalysisError(result.message);
        return;
      }

      setAnalysisMessage(result.message);
      router.refresh();
    });
  };

  const handleSaveVersion = () => {
    if (!selectedProjectId) {
      return;
    }

    setVersionError("");

    startSavingVersion(async () => {
      const result = await saveMatchAnalysisVersionAction(selectedProjectId);

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
      <section className="page-card p-6 sm:p-8">
        <span className="soft-chip">阶段 8 · Quest 8.1-8.5</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">JD 分析</h1>
        <div className="mt-6">
          <EmptyState
            icon={
              <svg className="h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
            title="还没有项目"
            description="创建项目并完成项目卡片确认后，才能开始 JD 分析和岗位匹配。"
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
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="soft-chip">阶段 8 · Quest 8.1-8.5</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">JD 分析</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">把已确认项目卡片与目标 JD 连接起来，产出岗位能力摘要、匹配分析草稿和可确认的表达重点。</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-4 text-sm shadow-sm xl:w-[320px]">
            <div className="text-xs text-slate-500">当前选中项目</div>
            <div className="mt-2 font-medium text-slate-900">{selectedProject?.name ?? "未选择项目"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">项目卡片：{projectCardExists ? "已就绪" : "未生成"}</div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="section-title">先选择要分析的项目</h2>
            <p className="section-copy mt-2">不同项目会有各自独立的 JD、摘要、匹配分析和版本记录。</p>
          </div>
          <select value={selectedProjectId ?? ""} onChange={(event) => handleProjectChange(event.target.value)} className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:max-w-sm">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.targetRole}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!projectCardExists ? (
        <section className="page-card p-6 sm:p-8">
          <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">当前项目还没有项目卡片，暂时无法开始匹配分析。先去项目卡片页生成并确认项目卡片，再回到这里继续。</div>
          <Link href={selectedProjectId ? `/project-card?projectId=${selectedProjectId}` : "/project-card"} className="mt-6 inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700">
            前往项目卡片页
          </Link>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">匹配分析版本</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{versionMessage}</p>
            {versionError ? <ErrorDisplay error={versionError} compact /> : null}
            <button type="button" onClick={handleSaveVersion} disabled={isSavingVersion || !analysisForm} className="mt-5 inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-slate-400">
              {isSavingVersion ? "正在保存版本..." : "保存匹配分析版本"}
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
          <section className="page-card p-6 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="soft-chip">Quest 8.1 · JD 原文保存</span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">录入目标 JD</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">先把目标岗位 JD 原文保存下来，后续所有岗位摘要和匹配分析都会基于这里的内容展开。</p>
              </div>
              <div className="text-sm text-slate-500">最近保存：{formatDateTime(latestJdSavedAt)}</div>
            </div>

            <textarea
              rows={12}
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="请粘贴目标岗位 JD 原文，例如岗位职责、任职要求、加分项等。"
              className="mt-6 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />

            {jdError ? <ErrorDisplay error={jdError} compact /> : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">{jdMessage}</p>
              <button type="button" onClick={handleSaveJd} disabled={isSavingJd || !selectedProjectId} className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-sky-300">
                {isSavingJd ? "正在保存 JD..." : "保存 JD 原文"}
              </button>
            </div>
          </section>

          <section className="page-card p-6 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="soft-chip">Quest 8.2 · 能力摘要</span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">解析 JD</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">系统会把岗位原文提炼为职责重点、能力关键词和优先级判断。</p>
              </div>
              <button type="button" onClick={handleGenerateSummary} disabled={isGeneratingSummary || !selectedProjectId} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isGeneratingSummary ? "正在解析 JD..." : "解析 JD"}
              </button>
            </div>

            {summaryError ? <ErrorDisplay error={summaryError} compact /> : null}
            <p className="mt-4 text-sm leading-7 text-slate-600">{summaryMessage}</p>
            {responseModel ? <div className="mt-3 text-xs text-slate-500">本轮生成模型：{responseModel}</div> : null}

            {capabilitySummary ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-sky-700">职责重点</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                    {capabilitySummary.responsibilities.map((item) => (
                      <div key={item} className="rounded-2xl bg-white px-4 py-3">{item}</div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-sky-700">能力关键词</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {capabilitySummary.capabilities.map((item) => (
                      <span key={item} className="rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-700">{item}</span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-sky-700">优先级</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                    {capabilitySummary.priorities.map((item) => (
                      <div key={`${item.label}-${item.level}`} className="rounded-2xl bg-white px-4 py-3">
                        <div className="font-medium text-slate-900">{item.label}</div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.level}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="page-card p-6 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="soft-chip">Quest 8.3 · Quest 8.4</span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">匹配分析草稿与重点确认</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">系统会优先输出更具体的岗位匹配判断，并在每个模块下补一段“说人话版”解释，帮助你更快看懂这份分析到底在说什么。</p>
              </div>
              <button type="button" onClick={handleGenerateAnalysis} disabled={isGeneratingAnalysis || !selectedProjectId} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isGeneratingAnalysis ? "正在生成分析..." : "开始匹配分析"}
              </button>
            </div>

            {analysisError ? <ErrorDisplay error={analysisError} compact /> : null}
            <p className="mt-4 text-sm leading-7 text-slate-600">{analysisMessage}</p>

            {analysisForm ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-800">匹配点</label>
                    <span className="text-xs text-slate-400">每行一条</span>
                  </div>
                  <textarea rows={5} value={analysisForm.matchedPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, matchedPoints: event.target.value } : current))} className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                    <label className="block text-sm font-medium text-sky-800">说人话版</label>
                    <textarea rows={4} value={analysisForm.plainMatchedPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, plainMatchedPoints: event.target.value } : current))} className="mt-3 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-800">差距点</label>
                    <span className="text-xs text-slate-400">每行一条</span>
                  </div>
                  <textarea rows={5} value={analysisForm.gapPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, gapPoints: event.target.value } : current))} className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                    <label className="block text-sm font-medium text-sky-800">说人话版</label>
                    <textarea rows={4} value={analysisForm.plainGapPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, plainGapPoints: event.target.value } : current))} className="mt-3 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-800">补充建议</label>
                    <span className="text-xs text-slate-400">每行一条</span>
                  </div>
                  <textarea rows={5} value={analysisForm.suggestionPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, suggestionPoints: event.target.value } : current))} className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                    <label className="block text-sm font-medium text-sky-800">说人话版</label>
                    <textarea rows={4} value={analysisForm.plainSuggestionPoints} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, plainSuggestionPoints: event.target.value } : current))} className="mt-3 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                  </div>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
                  <label className="block text-sm font-medium text-slate-800">匹配总结</label>
                  <textarea rows={4} value={analysisForm.summary} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, summary: event.target.value } : current))} className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="block text-sm font-medium text-slate-800">匹配分析状态</label>
                    <select value={analysisForm.status} onChange={(event) => setAnalysisForm((current) => (current ? { ...current, status: event.target.value as MatchAnalysisData["status"] } : current))} className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                      {matchStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-slate-500">最近分析保存：{formatDateTime(matchAnalysis?.updatedAt ?? null)}</p>
                  <button type="button" onClick={handleSaveAnalysis} disabled={isSavingAnalysis} className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-sky-300">
                    {isSavingAnalysis ? "正在保存分析..." : "保存当前匹配分析"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}
