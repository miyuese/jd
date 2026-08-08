"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateOneMinuteIntroAction,
  generateThreeMinuteStoryAction,
  generateInterviewQuestionsAction
} from "@/app/interview-prep/actions";
import { loadDraft, saveDraft } from "@/lib/draft-storage";
import { GeneratingIndicator } from "@/components/generating-indicator";

function draftInterviewKey(projectId: string | null) {
  return `jd-helper:draft:interview:${projectId ?? "none"}`;
}
import { EmptyState } from "@/components/empty-state";
import { ErrorDisplay } from "@/components/error-display";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
};

type InterviewPrepWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  jdRecords: Array<{ id: string; rawText: string; hasSummary: boolean; updatedAt: string }>;
  selectedJdId: string | null;
  projectCardExists: boolean;
  matchAnalysisExists: boolean;
  latestOutput: {
    oneMinuteIntro: string | null;
    threeMinuteStory: string | null;
    questions: string[] | null;
  };
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未生成";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function InterviewPrepWorkspace({
  projects,
  selectedProjectId,
  jdRecords,
  selectedJdId,
  projectCardExists,
  matchAnalysisExists,
  latestOutput,
  initialAbilityGaps
}: InterviewPrepWorkspaceProps) {
  const router = useRouter();

  const handleJdChange = (jdId: string) => {
    if (!selectedProjectId) {
      return;
    }
    router.push(`/interview-prep?projectId=${selectedProjectId}&jdId=${jdId}`);
  };
  const [isGeneratingOneMin, startGeneratingOneMin] = useTransition();
  const [isGeneratingThreeMin, startGeneratingThreeMin] = useTransition();
  const [isGeneratingQuestions, startGeneratingQuestions] = useTransition();

  const [oneMinuteIntro, setOneMinuteIntro] = useState(latestOutput.oneMinuteIntro ?? "");
  const [oneMinuteHighlights, setOneMinuteHighlights] = useState<string[]>([]);
  const [oneMinuteModel, setOneMinuteModel] = useState("");

  const [threeMinuteStory, setThreeMinuteStory] = useState(latestOutput.threeMinuteStory ?? "");
  const [threeMinuteHighlights, setThreeMinuteHighlights] = useState<string[]>([]);
  const [threeMinuteModel, setThreeMinuteModel] = useState("");

  const [questions, setQuestions] = useState<string[]>(latestOutput.questions ?? []);
  const [questionsModel, setQuestionsModel] = useState("");

  const [message, setMessage] = useState("基于已确认的项目卡片和 JD 匹配分析，生成面试表达内容。");
  const [error, setError] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    setOneMinuteIntro(latestOutput.oneMinuteIntro ?? "");
    setOneMinuteHighlights([]);
    setOneMinuteModel("");
    setThreeMinuteStory(latestOutput.threeMinuteStory ?? "");
    setThreeMinuteHighlights([]);
    setThreeMinuteModel("");
    setQuestions(latestOutput.questions ?? []);
    setQuestionsModel("");
    setError("");
    setMessage("基于已确认的项目卡片和 JD 匹配分析，生成面试表达内容。");

    // 从 localStorage 恢复上次未保存的面试输出（防刷新丢失）
    const saved = loadDraft<{ oneMinuteIntro?: string; threeMinuteStory?: string; questions?: string[] }>(
      draftInterviewKey(selectedProjectId)
    );
    if (saved) {
      if (saved.oneMinuteIntro) setOneMinuteIntro(saved.oneMinuteIntro);
      if (saved.threeMinuteStory) setThreeMinuteStory(saved.threeMinuteStory);
      if (saved.questions?.length) setQuestions(saved.questions);
    }
  }, [selectedProjectId, latestOutput]);

  // 输出变化时自动暂存（生成结果刷新不丢）
  useEffect(() => {
    saveDraft(draftInterviewKey(selectedProjectId), {
      oneMinuteIntro,
      threeMinuteStory,
      questions
    });
  }, [oneMinuteIntro, threeMinuteStory, questions, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/interview-prep?projectId=${projectId}`);
  };

  const handleGenerateOneMinute = () => {
    if (!selectedProjectId) {
      return;
    }

    setError("");

    startGeneratingOneMin(async () => {
      const result = await generateOneMinuteIntroAction(selectedProjectId, selectedJdId ?? undefined);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setOneMinuteIntro(result.script ?? "");
      setOneMinuteHighlights(result.highlights ?? []);
      setOneMinuteModel(result.model ?? "");
      setMessage(result.message);
      router.refresh();
    });
  };

  const handleGenerateThreeMinute = () => {
    if (!selectedProjectId) {
      return;
    }

    setError("");

    startGeneratingThreeMin(async () => {
      const result = await generateThreeMinuteStoryAction(selectedProjectId, selectedJdId ?? undefined);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setThreeMinuteStory(result.script ?? "");
      setThreeMinuteHighlights(result.highlights ?? []);
      setThreeMinuteModel(result.model ?? "");
      setMessage(result.message);
      router.refresh();
    });
  };

  const handleGenerateQuestions = () => {
    if (!selectedProjectId) {
      return;
    }

    setError("");

    startGeneratingQuestions(async () => {
      const result = await generateInterviewQuestionsAction(selectedProjectId, selectedJdId ?? undefined);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setQuestions(result.questions ?? []);
      setQuestionsModel(result.model ?? "");
      setMessage(result.message);
      router.refresh();
    });
  };

  const oneMinuteWords = oneMinuteIntro.trim().length;
  const threeMinuteWords = threeMinuteStory.trim().length;

  if (projects.length === 0) {
    return (
      <section className="page-card p-6 sm:p-8">
        <span className="soft-chip">面试准备</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">面试准备</h1>
        <div className="mt-6">
          <EmptyState
            icon={
              <svg className="h-12 w-12 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            }
            title="还没有项目"
            description="创建项目并完成项目卡片确认和 JD 匹配分析后，才能生成面试讲稿和追问清单。"
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
            <span className="soft-chip">面试表达</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">面试准备</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">基于已确认的项目事实和岗位匹配重点，生成适合口头表达的面试讲稿和高频追问清单。</p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-4 text-sm shadow-sm xl:w-[320px]">
            <div className="text-xs text-slate-500">当前选中项目</div>
            <div className="mt-2 font-medium text-slate-900">{selectedProject?.name ?? "未选择项目"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">项目卡片：{projectCardExists ? "已就绪" : "未生成"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">匹配分析：{matchAnalysisExists ? "已就绪" : "未生成"}</div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="section-title">先选择要准备的项目</h2>
            <p className="section-copy mt-2">不同项目会基于各自的项目卡片和 JD 匹配分析生成对应的面试内容。</p>
          </div>
          <div className="flex flex-col gap-3 lg:w-full lg:max-w-sm">
            <select
              value={selectedProjectId ?? ""}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} · {project.targetRole}
                </option>
              ))}
            </select>
            {jdRecords.length > 0 ? (
              <select
                value={selectedJdId ?? ""}
                onChange={(event) => handleJdChange(event.target.value)}
                className="w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                {jdRecords.map((jd, index) => (
                  <option key={jd.id} value={jd.id}>
                    目标 JD #{jdRecords.length - index} · {jd.hasSummary ? "已解析" : "未解析"}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </section>

      {initialAbilityGaps.length > 0 ? (
        <section className="page-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-amber-100 pb-4">
            <div>
              <h2 className="section-title">能力缺口补强建议</h2>
              <p className="section-copy mt-2">来自面试反馈回流：下面这些缺口是面试中被追问卡住的能力点，准备讲稿时优先补强。</p>
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
            当前项目还没有完整的项目卡片或匹配分析，暂时无法生成面试内容。请先完成项目卡片确认和 JD 匹配分析，再回到这里继续。
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {!projectCardExists ? (
              <Link
                href={selectedProjectId ? `/project-card?projectId=${selectedProjectId}` : "/project-card"}
                className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                前往项目卡片页
              </Link>
            ) : null}
            {!matchAnalysisExists ? (
              <Link
                href={selectedProjectId ? `/jd-analysis?projectId=${selectedProjectId}` : "/jd-analysis"}
                className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300"
              >
                前往 JD 分析页
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <ErrorDisplay error={error} compact /> : null}
      {isGeneratingOneMin || isGeneratingThreeMin || isGeneratingQuestions ? (
        <GeneratingIndicator label="AI 正在生成面试内容" />
      ) : null}
      {!error && <p className="text-sm leading-7 text-slate-600">{message}</p>}

      <section className="grid gap-6 xl:grid-cols-2">
        {/* 1 分钟介绍 */}
        <section className="page-card h-fit p-6 sm:p-8 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-5">
            <div>
              <span className="soft-chip">开场讲稿</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">1 分钟项目介绍</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">适合开场介绍的口语化短讲稿，约 150-180 字。</p>
            </div>
            <button
              type="button"
              onClick={handleGenerateOneMinute}
              disabled={isGeneratingOneMin || !selectedProjectId || !projectCardExists || !matchAnalysisExists}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isGeneratingOneMin ? "正在生成..." : "生成 1 分钟介绍"}
            </button>
          </div>

          {oneMinuteModel ? <div className="mt-4 text-xs text-slate-500">生成模型：{oneMinuteModel}</div> : null}

          <div className="mt-5 rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-sky-700">讲稿内容</div>
            <div className="mt-2 text-xs text-slate-500">字数：{oneMinuteWords}</div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {oneMinuteIntro || "还没有生成 1 分钟介绍。点击上方按钮后，这里会出现适合口头表达的项目介绍。"}
            </div>
          </div>

          {oneMinuteHighlights.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-sky-100 bg-white/90 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">讲稿重点</div>
              <div className="mt-4 grid gap-3">
                {oneMinuteHighlights.map((item) => (
                  <div key={item} className="rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* 3 分钟展开稿 */}
        <section className="page-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-5">
            <div>
              <span className="soft-chip">展开讲述</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">3 分钟展开讲述</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">覆盖背景、动作、决策和结果的完整讲述稿，约 450-500 字。</p>
            </div>
            <button
              type="button"
              onClick={handleGenerateThreeMinute}
              disabled={isGeneratingThreeMin || !selectedProjectId || !projectCardExists || !matchAnalysisExists}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isGeneratingThreeMin ? "正在生成..." : "生成 3 分钟展开稿"}
            </button>
          </div>

          {threeMinuteModel ? <div className="mt-4 text-xs text-slate-500">生成模型：{threeMinuteModel}</div> : null}

          <div className="mt-5 rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-sky-700">讲稿内容</div>
            <div className="mt-2 text-xs text-slate-500">字数：{threeMinuteWords}</div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {threeMinuteStory || "还没有生成 3 分钟展开稿。点击上方按钮后，这里会出现更完整的项目讲述。"}
            </div>
          </div>

          {threeMinuteHighlights.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-sky-100 bg-white/90 p-5 shadow-sm">
              <div className="text-xs uppercase tracking-[0.22em] text-sky-700">讲稿重点</div>
              <div className="mt-4 grid gap-3">
                {threeMinuteHighlights.map((item) => (
                  <div key={item} className="rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>

      {/* 高频追问清单 */}
      <section className="page-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-5">
          <div>
            <span className="soft-chip">追问预测</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">高频追问清单</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">围绕当前项目和目标岗位，生成可能被面试官追问的问题。</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateQuestions}
            disabled={isGeneratingQuestions || !selectedProjectId || !projectCardExists || !matchAnalysisExists}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isGeneratingQuestions ? "正在生成..." : "生成高频追问"}
          </button>
        </div>

        {questionsModel ? <div className="mt-4 text-xs text-slate-500">生成模型：{questionsModel}</div> : null}

        {questions.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {questions.map((question, index) => (
              <div key={index} className="rounded-[20px] border border-sky-100 bg-slate-50/70 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-slate-700">{question}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">
            还没有生成追问清单。点击上方按钮后，这里会出现可能被面试官追问的问题。
          </div>
        )}
      </section>
    </>
  );
}
