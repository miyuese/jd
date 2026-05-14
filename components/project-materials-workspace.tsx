"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  generateInterviewQuestionsAction,
  saveProjectMaterialAction,
  saveQuestionAnswerAction
} from "@/app/project-materials/actions";
import { FileUpload } from "@/components/file-upload";

type ProjectOption = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
};

type TimelineItem = {
  id: string;
  roundIndex: number;
  questionText: string;
  answerText: string;
  createdAt: string;
};

type ProjectMaterialsWorkspaceProps = {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  initialMaterialContent: string;
  materialSavedAt: string | null;
  initialTimeline: TimelineItem[];
};

type MaterialFormValues = {
  content: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未保存到数据库";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ProjectMaterialsWorkspace({
  projects,
  selectedProjectId,
  initialMaterialContent,
  materialSavedAt,
  initialTimeline
}: ProjectMaterialsWorkspaceProps) {
  const router = useRouter();
  const [isSavingMaterial, startSavingMaterial] = useTransition();
  const [isGeneratingQuestions, startGeneratingQuestions] = useTransition();
  const [isSavingAnswer, startSavingAnswer] = useTransition();
  const [materialMessage, setMaterialMessage] = useState(
    initialMaterialContent
      ? "当前项目已存在一份项目原始材料，可以继续完善后覆盖保存。"
      : "先为某个项目保存原始材料，再开始 AI 采访式复盘。"
  );
  const [materialError, setMaterialError] = useState("");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(materialSavedAt);
  const [questionMessage, setQuestionMessage] = useState("还没有生成采访问题。先保存项目材料，再点击“开始复盘”。");
  const [questionError, setQuestionError] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [responseModel, setResponseModel] = useState("");
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({});
  const [timelineMessage, setTimelineMessage] = useState(
    initialTimeline.length > 0
      ? "下方是已保存到数据库的复盘时间线。"
      : "还没有已保存的问答记录。先回答一条 AI 问题，时间线就会出现。"
  );
  const [timelineError, setTimelineError] = useState("");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const form = useForm<MaterialFormValues>({
    defaultValues: {
      content: initialMaterialContent
    }
  });
  const content = form.watch("content");

  useEffect(() => {
    form.reset({ content: initialMaterialContent });
    setLatestSavedAt(materialSavedAt);
    setMaterialError("");
    setQuestionError("");
    setTimelineError("");
    setGeneratedQuestions([]);
    setResponseModel("");
    setAnswerValues({});
    setMaterialMessage(
      initialMaterialContent
        ? "当前项目已存在一份项目原始材料，可以继续完善后覆盖保存。"
        : "先为某个项目保存原始材料，再开始 AI 采访式复盘。"
    );
    setQuestionMessage("还没有生成采访问题。先保存项目材料，再点击“开始复盘”。");
    setTimelineMessage(
      initialTimeline.length > 0
        ? "下方是已保存到数据库的复盘时间线。"
        : "还没有已保存的问答记录。先回答一条 AI 问题，时间线就会出现。"
    );
  }, [form, initialMaterialContent, initialTimeline, materialSavedAt, selectedProjectId]);

  const handleProjectChange = (projectId: string) => {
    router.push(`/project-materials?projectId=${projectId}`);
  };

  const handleSaveMaterial = (values: MaterialFormValues) => {
    if (!selectedProjectId) {
      return;
    }

    setMaterialError("");

    startSavingMaterial(async () => {
      const result = await saveProjectMaterialAction(selectedProjectId, values.content);

      if (!result.success) {
        setMaterialError(result.message);
        return;
      }

      setMaterialMessage(result.message);
      setLatestSavedAt(result.savedAt ?? new Date().toISOString());
      router.refresh();
    });
  };

  const handleGenerateQuestions = () => {
    if (!selectedProjectId) {
      return;
    }

    setQuestionError("");

    startGeneratingQuestions(async () => {
      const result = await generateInterviewQuestionsAction(selectedProjectId);

      if (!result.success) {
        setGeneratedQuestions([]);
        setResponseModel("");
        setQuestionError(result.message);
        return;
      }

      setGeneratedQuestions(result.questions ?? []);
      setResponseModel(result.model ?? "");
      setQuestionMessage(result.message);
    });
  };

  const handleAnswerChange = (question: string, value: string) => {
    setAnswerValues((current) => ({
      ...current,
      [question]: value
    }));
  };

  const handleSaveAnswer = (question: string) => {
    if (!selectedProjectId) {
      return;
    }

    setTimelineError("");

    startSavingAnswer(async () => {
      const result = await saveQuestionAnswerAction(selectedProjectId, question, answerValues[question] ?? "");

      if (!result.success) {
        setTimelineError(result.message);
        return;
      }

      setTimelineMessage(result.message);
      setAnswerValues((current) => ({
        ...current,
        [question]: ""
      }));
      router.refresh();
    });
  };

  const handleFileTextExtracted = (text: string, fileName: string) => {
    form.setValue("content", text);
    setMaterialMessage(`已从文件「${fileName}」提取文字内容，可以继续编辑后保存到数据库。`);
  };

  if (projects.length === 0) {
    return (
      <section className="page-card p-6 sm:p-8">
        <span className="soft-chip">阶段 6 · Quest 6.2-6.4</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">项目原始材料与 AI 复盘</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          当前账号还没有项目，暂时无法保存项目材料或发起 AI 采访式复盘。
        </p>
        <div className="mt-6 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 p-6 text-sm leading-7 text-slate-600">
          先去工作台创建至少一个项目，随后再回到这里录入项目材料、生成首轮问题并保存问答时间线。
        </div>
        <Link
          href="/workspace"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          前往工作台创建项目
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="soft-chip">阶段 6 · Quest 6.2-6.4 · 阶段 11 · Quest 11.4-11.5</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">项目原始材料与 AI 复盘</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              先把某个项目的草稿、笔记和碎片化事实保存到数据库，再基于目标岗位发起首轮采访式问题，并把一问一答沉淀成可回看的复盘时间线。
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-4 text-sm shadow-sm xl:w-[320px]">
            <div className="text-xs text-slate-500">当前选中项目</div>
            <div className="mt-2 font-medium text-slate-900">{selectedProject?.name ?? "未选择项目"}</div>
            <div className="mt-1 text-xs leading-6 text-slate-600">目标岗位：{selectedProject?.targetRole ?? "-"}</div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="section-title">先选择要复盘的项目</h2>
            <p className="section-copy mt-2">项目材料、AI 问题和问答时间线都会绑定到当前选中的项目。</p>
          </div>
          <select
            value={selectedProjectId ?? ""}
            onChange={(event) => handleProjectChange(event.target.value)}
            className="w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 lg:max-w-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.targetRole}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="page-card p-6 sm:p-8" onSubmit={form.handleSubmit(handleSaveMaterial)}>
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
            <div>
              <h2 className="section-title">项目原始材料</h2>
              <p className="section-copy mt-2">这里保存的是项目事实本身，而不是已经包装好的简历话术。</p>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
              当前项目专属
            </span>
          </div>

          <div className="mt-6">
            <FileUpload onTextExtracted={handleFileTextExtracted} />
          </div>

          <textarea
            rows={16}
            placeholder="例如：项目背景、负责模块、关键动作、协作对象、遇到的难点、最终结果、可量化指标......"
            className="mt-4 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            {...form.register("content")}
          />

          {materialError ? <p className="mt-3 text-sm text-rose-500">{materialError}</p> : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              字数：{content.trim().length} · 最近数据库保存：{formatDateTime(latestSavedAt)}
            </div>
            <button
              type="submit"
              disabled={isSavingMaterial || !selectedProjectId}
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {isSavingMaterial ? "正在保存项目材料..." : "保存项目材料"}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">当前项目摘要</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">项目名称</div>
                <div className="mt-2 font-medium text-slate-900">{selectedProject?.name}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">目标岗位</div>
                <div className="mt-2 font-medium text-slate-900">{selectedProject?.targetRole}</div>
              </div>
              <div className="rounded-2xl bg-sky-50/70 px-4 py-3">{selectedProject?.currentNeed}</div>
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">保存结果</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{materialMessage}</p>
            <div className="mt-4 rounded-2xl bg-sky-50/70 p-4 text-sm leading-7 text-slate-700">
              {content.trim()
                ? content
                : "还没有录入项目原始材料。先把零散事实贴进来，保存后刷新页面应该仍会回填。"}
            </div>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="soft-chip">Quest 6.3 · 首轮采访问题</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">开始复盘</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">AI 会根据当前项目的目标岗位和原始材料，生成 3 到 5 条采访式问题。</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateQuestions}
            disabled={isGeneratingQuestions || !selectedProjectId}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isGeneratingQuestions ? "正在生成问题..." : "开始复盘"}
          </button>
        </div>

        {questionError ? <p className="mt-4 text-sm text-rose-500">{questionError}</p> : null}

        <div className="mt-4 text-sm leading-7 text-slate-600">{questionMessage}</div>

        {responseModel ? (
          <div className="mt-3 text-xs text-slate-500">本轮生成模型：{responseModel}</div>
        ) : null}

        {generatedQuestions.length > 0 ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {generatedQuestions.map((question, index) => (
              <article key={question} className="rounded-[24px] border border-sky-100 bg-slate-50/75 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-sky-700">问题 {index + 1}</div>
                <h3 className="mt-3 text-base font-medium leading-7 text-slate-900">{question}</h3>
                <textarea
                  rows={5}
                  value={answerValues[question] ?? ""}
                  onChange={(event) => handleAnswerChange(question, event.target.value)}
                  placeholder="用你自己的真实经历来回答这条问题。回答保存后，下方会出现一问一答时间线。"
                  className="mt-4 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">建议优先回答可量化结果、关键动作和判断依据。</span>
                  <button
                    type="button"
                    onClick={() => handleSaveAnswer(question)}
                    disabled={isSavingAnswer}
                    className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {isSavingAnswer ? "正在保存..." : "保存这一问答"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="soft-chip">Quest 6.4 · 复盘时间线</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">已保存问答</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">这里只展示已落库的一问一答记录，刷新页面后仍应存在。</p>
          </div>
        </div>

        {timelineError ? <p className="mt-4 text-sm text-rose-500">{timelineError}</p> : null}

        <p className="mt-4 text-sm leading-7 text-slate-600">{timelineMessage}</p>

        {initialTimeline.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 px-5 py-8 text-sm leading-7 text-slate-600">
            还没有已保存的复盘问答。先在上方生成首轮问题，回答其中一条并点击“保存这一问答”，这里就会出现时间线。
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {initialTimeline.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-sky-100 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-sky-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-slate-900">第 {item.roundIndex} 轮复盘</div>
                  <div className="text-xs text-slate-500">保存时间：{formatDateTime(item.createdAt)}</div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-sky-50/70 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-sky-700">AI 提问</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.questionText}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">你的回答</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.answerText}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
