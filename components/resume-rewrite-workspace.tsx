"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateResumeFragmentRewriteAction,
  generateResumeRewriteAction,
  saveResumeRewriteContextAction
} from "@/app/resume-rewrite/actions";
import { EmptyState } from "@/components/empty-state";
import { ErrorDisplay } from "@/components/error-display";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
};

type ResumeRewriteWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  initialResumeText: string;
  resumeSavedAt: string | null;
  projectCardExists: boolean;
  matchAnalysisExists: boolean;
  initialAbilityGaps: AbilityGapItem[];
};

type AbilityGapItem = {
  tagId: string;
  name: string;
  description: string | null;
  confidence: number;
  status: string;
  updatedAt: string;
  evidence: Array<{
    chunkId: string;
    content: string;
    sourceTitle: string | null;
    sourceType: string | null;
  }>;
};

type RewriteMode = "balanced" | "result-focused" | "responsibility-focused" | "jd-focused";

const rewriteModeOptions: Array<{ value: RewriteMode; label: string; description: string }> = [
  { value: "balanced", label: "平衡版", description: "职责、动作、结果相对均衡" },
  { value: "result-focused", label: "结果优先", description: "优先强调产出与业务价值" },
  { value: "responsibility-focused", label: "职责优先", description: "优先强调你具体负责了什么" },
  { value: "jd-focused", label: "岗位贴合", description: "优先用更贴岗位的表达方式" }
];

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

export function ResumeRewriteWorkspace({
  projects,
  selectedProjectId,
  initialResumeText,
  resumeSavedAt,
  projectCardExists,
  matchAnalysisExists,
  initialAbilityGaps
}: ResumeRewriteWorkspaceProps) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isGeneratingFragment, startGeneratingFragment] = useTransition();
  const [isSavingContext, startSavingContext] = useTransition();
  const [resumeContext, setResumeContext] = useState(initialResumeText);
  const [rewriteDraft, setRewriteDraft] = useState("");
  const [rewriteReasoning, setRewriteReasoning] = useState("");
  const [rewriteHighlights, setRewriteHighlights] = useState<string[]>([]);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("balanced");
  const [applyMode, setApplyMode] = useState<"append" | "fragment-rewrite" | "replace-all">("append");
  const [selectedFragment, setSelectedFragment] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [fragmentRewriteDraft, setFragmentRewriteDraft] = useState("");
  const [fragmentRewriteReasoning, setFragmentRewriteReasoning] = useState("");
  const [showFragmentPreview, setShowFragmentPreview] = useState(false);
  const [rewriteMessage, setRewriteMessage] = useState("先生成一版简历改写草稿，再决定是否把它写入当前简历上下文。");
  const [rewriteError, setRewriteError] = useState("");
  const [saveMessage, setSaveMessage] = useState(
    initialResumeText ? "当前简历上下文已从数据库回填，可以继续编辑或应用改写稿。" : "当前还没有简历上下文内容，请先到简历材料页补充。"
  );
  const [saveError, setSaveError] = useState("");
  const [responseModel, setResponseModel] = useState("");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(resumeSavedAt);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const resumeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setResumeContext(initialResumeText);
    setLatestSavedAt(resumeSavedAt);
    setRewriteDraft("");
    setRewriteReasoning("");
    setRewriteHighlights([]);
    setRewriteMode("balanced");
    setApplyMode("append");
    setSelectedFragment("");
    setSelectedRange(null);
    setFragmentRewriteDraft("");
    setFragmentRewriteReasoning("");
    setShowFragmentPreview(false);
    setRewriteError("");
    setSaveError("");
    setResponseModel("");
    setRewriteMessage("先生成一版简历改写草稿，再决定是否把它写入当前简历上下文。");
    setSaveMessage(
      initialResumeText ? "当前简历上下文已从数据库回填，可以继续编辑或应用改写稿。" : "当前还没有简历上下文内容，请先到简历材料页补充。"
    );
  }, [initialResumeText, resumeSavedAt, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/resume-rewrite?projectId=${projectId}`);
  };

  const handleGenerateRewrite = () => {
    if (!selectedProjectId) {
      return;
    }

    setRewriteError("");

    startGenerating(async () => {
      const result = await generateResumeRewriteAction(selectedProjectId, initialResumeText, rewriteMode);

      if (!result.success) {
        setRewriteError(result.message);
        return;
      }

      setRewriteDraft(result.rewrite ?? "");
      setRewriteReasoning(result.reasoning ?? "");
      setRewriteHighlights(result.highlights ?? []);
      setResponseModel(result.model ?? "");
      setRewriteMessage(result.message);
    });
  };

  const handleApplyRewrite = () => {
    if (!rewriteDraft.trim()) {
      return;
    }

    setResumeContext((current) => {
      if (applyMode === "replace-all") {
        return rewriteDraft;
      }

      if (applyMode === "fragment-rewrite" && selectedFragment.trim() && fragmentRewriteDraft.trim()) {
        return current.includes(selectedFragment) ? current.replace(selectedFragment, fragmentRewriteDraft) : current;
      }

      if (!current.trim()) {
        return rewriteDraft;
      }

      return `${current.trim()}\n\n${rewriteDraft}`;
    });

    setSaveMessage(
      applyMode === "replace-all"
        ? "改写草稿已整体替换当前简历上下文编辑区，请确认后保存。"
        : applyMode === "fragment-rewrite"
          ? "片段改写结果已尝试替换指定原文片段，请检查结果后保存。"
          : "改写草稿已追加到当前简历上下文编辑区，你可以继续手动调整后再保存。"
    );
  };

  const handleGenerateFragmentRewrite = () => {
    if (!selectedProjectId) {
      return;
    }

    setRewriteError("");

    startGeneratingFragment(async () => {
      const result = await generateResumeFragmentRewriteAction(selectedProjectId, resumeContext, selectedFragment, rewriteMode);

      if (!result.success) {
        setRewriteError(result.message);
        return;
      }

      setFragmentRewriteDraft(result.rewrite ?? "");
      setFragmentRewriteReasoning(result.reasoning ?? "");
      setResponseModel(result.model ?? "");
      setRewriteMessage(result.message);
      setShowFragmentPreview(true);
    });
  };

  const captureSelection = () => {
    const textarea = resumeTextareaRef.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selectedText = resumeContext.slice(start, end).trim();

    setSelectedFragment(selectedText);
    setSelectedRange(start !== end ? { start, end } : null);
  };

  const handleConfirmFragmentReplace = () => {
    if (!selectedRange || !fragmentRewriteDraft.trim()) {
      return;
    }

    setResumeContext((current) => `${current.slice(0, selectedRange.start)}${fragmentRewriteDraft}${current.slice(selectedRange.end)}`);
    setShowFragmentPreview(false);
    setSaveMessage("片段改写候选已替换回编辑区，请检查结果后保存。");
  };

  const originalWords = initialResumeText.trim().length;
  const rewriteWords = rewriteDraft.trim().length;

  const handleSaveContext = () => {
    setSaveError("");

    startSavingContext(async () => {
      const result = await saveResumeRewriteContextAction(resumeContext);

      if (!result.success) {
        setSaveError(result.message);
        return;
      }

      setSaveMessage(result.message);
      setLatestSavedAt(result.savedAt ?? new Date().toISOString());
      router.refresh();
    });
  };

  if (projects.length === 0) {
    return (
      <section className="page-card p-6 sm:p-8">
        <span className="soft-chip">简历改写</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">简历改写</h1>
        <div className="mt-6">
          <EmptyState
            icon={
              <svg className="h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            }
            title="还没有项目"
            description="创建项目并完成项目卡片确认和 JD 匹配分析后，才能开始简历改写。"
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
            <span className="soft-chip">岗位定制</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">简历改写</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">把已确认的项目事实和岗位匹配重点转成更贴当前 JD 的简历项目描述，并写回当前简历上下文。</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-4 text-sm shadow-sm xl:w-[320px]">
            <div className="text-xs text-slate-500">当前选中项目</div>
            <div className="mt-2 font-medium text-slate-900">{selectedProject?.name ?? "未选择项目"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">项目卡片：{projectCardExists ? "已就绪" : "未生成"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">匹配分析：{matchAnalysisExists ? "已就绪" : "未生成"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">简历最近保存：{formatDateTime(latestSavedAt)}</div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="section-title">先选择要改写的项目</h2>
            <p className="section-copy mt-2">不同项目会基于各自的项目卡片和 JD 匹配分析生成对应的简历改写草稿。</p>
          </div>
          <select value={selectedProjectId ?? ""} onChange={(event) => handleProjectChange(event.target.value)} className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:max-w-sm">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.targetRole}
              </option>
            ))}
          </select>
        </div>
      </section>

      {initialAbilityGaps.length > 0 ? (
        <section className="page-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-amber-100 pb-4">
            <div>
              <h2 className="section-title">能力缺口补强建议</h2>
              <p className="section-copy mt-2">来自面试反馈回流：这些能力缺口会自动纳入本次改写的记忆召回，改写时注意补强对应证据。</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              {initialAbilityGaps.length} 个缺口
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {initialAbilityGaps.map((gap) => (
              <div key={gap.tagId} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    {gap.name}
                  </span>
                  <span className="text-xs text-slate-400">{gap.evidence.length} 条证据</span>
                </div>
                {gap.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{gap.description}</p> : null}
                {gap.evidence.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-amber-600">查看来自面试反馈的证据</summary>
                    <div className="mt-2 space-y-2">
                      {gap.evidence.map((evidence) => (
                        <div key={evidence.chunkId} className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">
                          {evidence.content}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!projectCardExists || !matchAnalysisExists ? (
        <section className="page-card p-6 sm:p-8">
          <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">
            当前项目还没有完整的项目卡片或匹配分析，暂时无法开始简历改写。请先完成项目卡片确认和 JD 匹配分析，再回到这里继续。
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {!projectCardExists ? (
              <Link href={selectedProjectId ? `/project-card?projectId=${selectedProjectId}` : "/project-card"} className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-700">
                前往项目卡片页
              </Link>
            ) : null}
            {!matchAnalysisExists ? (
              <Link href={selectedProjectId ? `/jd-analysis?projectId=${selectedProjectId}` : "/jd-analysis"} className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300">
                前往 JD 分析页
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="page-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-5">
            <div>
              <span className="soft-chip">改写对比</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">原文与改写稿对比</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">左侧保留当前简历原文，右侧展示针对当前项目生成的改写稿。</p>
            </div>
            <button type="button" onClick={handleGenerateRewrite} disabled={isGenerating || !selectedProjectId || !projectCardExists || !matchAnalysisExists} className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isGenerating ? "正在生成改写稿..." : "生成简历改写草稿"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {rewriteModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRewriteMode(option.value)}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${rewriteMode === option.value ? "border-sky-300 bg-sky-50 text-sky-800" : "border-sky-100 bg-white text-slate-700 hover:border-sky-200"}`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-2 text-xs leading-6 text-slate-500">{option.description}</div>
              </button>
            ))}
          </div>

          {rewriteError ? <ErrorDisplay error={rewriteError} compact /> : null}
          <p className="mt-4 text-sm leading-7 text-slate-600">{rewriteMessage}</p>
          {responseModel ? <div className="mt-3 text-xs text-slate-500">本轮生成模型：{responseModel}</div> : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">已有简历原文</div>
              <div className="mt-2 text-xs text-slate-500">字符数：{originalWords}</div>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{initialResumeText || "当前还没有简历原文，请先到简历材料页补充。"}</div>
            </div>

            <div className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">改写草稿</div>
              <div className="mt-2 text-xs text-slate-500">字符数：{rewriteWords}</div>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{rewriteDraft || "还没有生成改写草稿。点击上方按钮后，这里会出现更贴岗位的项目描述。"}</div>
            </div>
          </div>

          {rewriteDraft ? (
            <div className="mt-5 rounded-[24px] border border-sky-100 bg-white/90 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">本轮改写重点</div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {rewriteHighlights.length > 0 ? (
                  rewriteHighlights.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">本轮改写已经更贴岗位表达，你可以重点检查职责组织方式、结果呈现和关键词是否更符合当前 JD。</div>
                )}
              </div>
            </div>
          ) : null}

          {rewriteReasoning ? (
            <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50/70 p-5 text-sm leading-7 text-slate-700">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">改写思路</div>
              <div className="mt-3 whitespace-pre-wrap">{rewriteReasoning}</div>
            </div>
          ) : null}
        </section>

        <section className="page-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-5">
            <div>
              <span className="soft-chip">应用改写</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">当前简历上下文</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">这里是可编辑的简历上下文。基础版会把改写稿插入编辑区，再由你确认后保存。</p>
            </div>
          </div>

            <textarea ref={resumeTextareaRef} rows={20} value={resumeContext} onSelect={captureSelection} onChange={(event) => setResumeContext(event.target.value)} className="mt-6 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="这里会展示当前简历上下文。你可以先生成改写稿，再点击“应用改写到编辑区”。" />

          <div className="mt-5 grid gap-4 rounded-[24px] border border-sky-100 bg-slate-50/70 p-5 lg:grid-cols-3">
            {[
              { value: "append", label: "追加到末尾", description: "最稳的基础方式，不覆盖现有内容" },
              { value: "fragment-rewrite", label: "片段重写", description: "先重写一段原文，再选择替换回去" },
              { value: "replace-all", label: "整体替换", description: "用改写稿整体覆盖当前编辑区" }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setApplyMode(option.value as "append" | "fragment-rewrite" | "replace-all")}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${applyMode === option.value ? "border-sky-300 bg-sky-50 text-sky-800" : "border-sky-100 bg-white text-slate-700 hover:border-sky-200"}`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-2 text-xs leading-6 text-slate-500">{option.description}</div>
              </button>
            ))}
          </div>

          {applyMode === "fragment-rewrite" ? (
            <div className="mt-4 rounded-[24px] border border-sky-100 bg-sky-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-sky-800">已选中的原文片段</label>
                <button type="button" onClick={captureSelection} className="rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-medium text-sky-700 transition hover:border-sky-300">
                  读取当前选区
                </button>
              </div>
              <textarea rows={4} value={selectedFragment} readOnly className="mt-3 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none" placeholder="先在上方简历上下文编辑区里选中一段原文，再点“读取当前选区”或直接选择文本。" />
              <button type="button" onClick={handleGenerateFragmentRewrite} disabled={isGeneratingFragment || !selectedFragment.trim()} className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isGeneratingFragment ? "正在生成片段改写..." : "生成片段改写"}
              </button>

              {fragmentRewriteDraft && showFragmentPreview ? (
                <div className="mt-4 rounded-2xl border border-dashed border-sky-300 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-sky-700">候选替换预览</div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">原文片段</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedFragment}</div>
                    </div>
                    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3">
                      <div className="text-xs text-sky-700">建议替换为</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{fragmentRewriteDraft}</div>
                    </div>
                  </div>
                  {fragmentRewriteReasoning ? <div className="mt-3 text-sm leading-7 text-slate-500">{fragmentRewriteReasoning}</div> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={handleConfirmFragmentReplace} className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-700">
                      确认替换选中区域
                    </button>
                    <button type="button" onClick={() => setShowFragmentPreview(false)} className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300">
                      取消这次替换
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {saveError ? <ErrorDisplay error={saveError} compact /> : null}

          <div className="mt-5 flex flex-wrap gap-3 border-t border-sky-100 pt-4">
            <button type="button" onClick={handleApplyRewrite} disabled={applyMode === "fragment-rewrite" ? !fragmentRewriteDraft.trim() : !rewriteDraft.trim()} className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-slate-400">
              应用改写到编辑区
            </button>
            <button type="button" onClick={handleSaveContext} disabled={isSavingContext} className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(83,74,183,0.9)] transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-primary-300">
              {isSavingContext ? "正在保存简历上下文..." : "保存当前简历上下文"}
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50/70 p-5 text-sm leading-7 text-slate-700">
            <div className="text-xs uppercase tracking-[0.22em] text-sky-700">当前状态</div>
            <div className="mt-3">{saveMessage}</div>
          </div>
        </section>
      </section>
    </>
  );
}
