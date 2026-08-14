"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  deleteProjectMaterialAction,
  generateInterviewQuestionsAction,
  listProjectMaterialQuestionsAction,
  saveProjectMaterialAction,
  saveQuestionAnswerAction,
  updateProjectMaterialAction
} from "@/app/project-materials/actions";
import { FileUpload } from "@/components/file-upload";
import { ErrorDisplay } from "@/components/error-display";
import { GeneratingIndicator } from "@/components/generating-indicator";
import { Plus, Trash2 } from "lucide-react";

type MaterialItem = {
  id: string;
  projectName: string;
  rawText: string;
  updatedAt: string;
};

type TimelineItem = {
  id: string;
  roundIndex: number;
  questionText: string;
  answerText: string;
  createdAt: string;
};

type ProjectMaterialsWorkspaceProps = {
  materials: MaterialItem[];
};

type MaterialFormValues = {
  projectName: string;
  content: string;
};

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

export function ProjectMaterialsWorkspace({ materials }: ProjectMaterialsWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(materials[0]?.id ?? null);
  const [isSavingMaterial, startSavingMaterial] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isGeneratingQuestions, startGeneratingQuestions] = useTransition();
  const [isSavingAnswer, startSavingAnswer] = useTransition();
  const [materialMessage, setMaterialMessage] = useState(
    materials.length > 0 ? "选择左侧一条项目经历进行编辑，或新建一条。" : "还没有项目经历。先录入一条，之后建卡片时可自由组合多份经历。"
  );
  const [materialError, setMaterialError] = useState("");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(materials[0]?.updatedAt ?? null);
  const [questionMessage, setQuestionMessage] = useState("选择一条项目经历后，可基于其材料生成采访式复盘问题。");
  const [questionError, setQuestionError] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [responseModel, setResponseModel] = useState("");
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({});
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineMessage, setTimelineMessage] = useState("还没有已保存的问答记录。");
  const [timelineError, setTimelineError] = useState("");

  const selectedMaterial = materials.find((material) => material.id === selectedId) ?? null;

  const form = useForm<MaterialFormValues>({
    defaultValues: {
      projectName: selectedMaterial?.projectName ?? "",
      content: selectedMaterial?.rawText ?? ""
    }
  });
  const content = form.watch("content");

  // 加载选中经历的问答时间线
  useEffect(() => {
    if (!selectedId) {
      setTimeline([]);
      return;
    }

    setTimeline([]);
    setGeneratedQuestions([]);
    setAnswerValues({});
    setQuestionError("");
    setTimelineError("");
    setQuestionMessage("正在读取这条经历的复盘记录...");

    listProjectMaterialQuestionsAction(selectedId)
      .then((result) => {
        if (result.success && result.timeline) {
          setTimeline(result.timeline);
          setTimelineMessage(result.timeline.length > 0 ? "下方是你的复盘时间线。" : "还没有已保存的问答记录。先回答一条 AI 问题，时间线就会出现。");
          setQuestionMessage(result.timeline.length > 0 ? "已基于这条经历生成过复盘问题，可继续回答或重新生成。" : "选择一条项目经历后，可基于其材料生成采访式复盘问题。");
        }
      })
      .catch(() => {
        setTimelineMessage("读取问答时间线失败，请稍后刷新。");
      });
  }, [selectedId]);

  // 选中经历变化时回填表单
  useEffect(() => {
    form.reset({
      projectName: selectedMaterial?.projectName ?? "",
      content: selectedMaterial?.rawText ?? ""
    });
    setLatestSavedAt(selectedMaterial?.updatedAt ?? null);
    setMaterialError("");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectMaterial = (materialId: string) => {
    setSelectedId(materialId);
  };

  const handleNewMaterial = () => {
    setSelectedId(null);
    form.reset({ projectName: "", content: "" });
    setLatestSavedAt(null);
    setMaterialError("");
    setGeneratedQuestions([]);
    setTimeline([]);
    setQuestionMessage("填写项目名称与内容后保存，即可基于它开始采访式复盘。");
  };

  const handleSaveMaterial = (values: MaterialFormValues) => {
    setMaterialError("");

    startSavingMaterial(async () => {
      const result = selectedId
        ? await updateProjectMaterialAction(selectedId, values.projectName, values.content)
        : await saveProjectMaterialAction(values.projectName, values.content);

      if (!result.success) {
        setMaterialError(result.message);
        return;
      }

      setMaterialMessage(result.message);
      setLatestSavedAt(result.savedAt ?? new Date().toISOString());
      router.refresh();
    });
  };

  const handleDeleteMaterial = (materialId: string) => {
    const material = materials.find((item) => item.id === materialId);
    if (!material) {
      return;
    }

    if (!window.confirm(`确定删除项目经历「${material.projectName}」吗？其问答记录与卡片关联会一并删除。`)) {
      return;
    }

    setMaterialError("");

    startDeleting(async () => {
      const result = await deleteProjectMaterialAction(materialId);

      if (!result.success) {
        setMaterialError(result.message);
        return;
      }

      setMaterialMessage(result.message);
      setSelectedId(null);
      form.reset({ projectName: "", content: "" });
      router.refresh();
    });
  };

  const handleGenerateQuestions = () => {
    if (!selectedId) {
      return;
    }

    setQuestionError("");

    startGeneratingQuestions(async () => {
      const result = await generateInterviewQuestionsAction(selectedId);

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
    if (!selectedId) {
      return;
    }

    setTimelineError("");

    startSavingAnswer(async () => {
      const result = await saveQuestionAnswerAction(selectedId, question, answerValues[question] ?? "");

      if (!result.success) {
        setTimelineError(result.message);
        return;
      }

      setTimelineMessage(result.message);
      setAnswerValues((current) => ({
        ...current,
        [question]: ""
      }));

      // 重新拉取时间线
      const timelineResult = await listProjectMaterialQuestionsAction(selectedId);
      if (timelineResult.success && timelineResult.timeline) {
        setTimeline(timelineResult.timeline);
      }
    });
  };

  const handleFileTextExtracted = (text: string, fileName: string) => {
    form.setValue("content", text);
    setMaterialMessage(`已从文件「${fileName}」提取文字内容，可以继续编辑后保存。`);
  };

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative">
          <span className="soft-chip">素材库</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">项目经历</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            项目经历是你的原始素材，独立于求职计划存在，可保存多份。每份经历都可以用 AI 采访式复盘打磨，之后建卡片时自由组合多份经历。
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* 左侧：经历列表 */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="page-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">我的项目经历</h3>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">{materials.length} 条</span>
            </div>

            <button
              type="button"
              onClick={handleNewMaterial}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-sky-200 bg-sky-50/60 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              新建项目经历
            </button>

            <div className="mt-4 space-y-2">
              {materials.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-sky-200 bg-slate-50/70 px-4 py-6 text-center text-sm leading-6 text-slate-500">
                  还没有项目经历
                  <br />
                  点击上方「新建」开始录入
                </p>
              ) : (
                materials.map((material) => (
                  <div
                    key={material.id}
                    className={`group flex items-start gap-2 rounded-2xl border px-3.5 py-3 transition ${selectedId === material.id ? "border-sky-300 bg-sky-50" : "border-slate-100 bg-white hover:border-sky-200"}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectMaterial(material.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium text-slate-900">{material.projectName}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{material.rawText.slice(0, 40)}...</div>
                      <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(material.updatedAt)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaterial(material.id)}
                      disabled={isDeleting}
                      className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`删除 ${material.projectName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：编辑器 + 复盘 */}
        <div className="space-y-6">
          <form className="page-card p-6 sm:p-8" onSubmit={form.handleSubmit(handleSaveMaterial)}>
            <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
              <div>
                <h2 className="section-title">{selectedId ? "编辑项目经历" : "新建项目经历"}</h2>
                <p className="section-copy mt-2">这里保存的是项目事实本身，而不是已经包装好的简历话术。</p>
              </div>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                用户级素材 · 独立于求职计划
              </span>
            </div>

            <div className="mt-5 rounded-[24px] border border-sky-100 bg-slate-50/70 p-5">
              <label className="block text-sm font-medium text-slate-800" htmlFor="projectName">
                项目经历名称 <span className="text-rose-500">*</span>
              </label>
              <p className="mt-1 text-sm leading-6 text-slate-500">给这段经历起个名字（例如：AI 求职助手 / 电商中台重构），多份经历组合生成卡片时会用它做区分。</p>
              <input
                id="projectName"
                type="text"
                placeholder="例如：AI 求职助手从 0 到 1"
                className="mt-3 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                {...form.register("projectName")}
              />
              {form.formState.errors.projectName ? (
                <p className="mt-2 text-sm text-rose-500">{form.formState.errors.projectName.message}</p>
              ) : null}
            </div>

            <div className="mt-5">
              <FileUpload onTextExtracted={handleFileTextExtracted} />
            </div>

            <textarea
              rows={14}
              placeholder="例如：项目背景、负责模块、关键动作、协作对象、遇到的难点、最终结果、可量化指标......"
              className="mt-4 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              {...form.register("content")}
            />

            {materialError ? <ErrorDisplay error={materialError} compact /> : null}

            <div className="mt-4 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                字数：{content.trim().length} · 最近保存：{formatDateTime(latestSavedAt)}
              </div>
              <button
                type="submit"
                disabled={isSavingMaterial}
                className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(83,74,183,0.9)] transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-primary-300"
              >
                {isSavingMaterial ? "正在保存..." : selectedId ? "保存修改" : "保存新经历"}
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600">{materialMessage}</p>
          </form>

          {selectedId ? (
            <>
              <section className="page-card p-6 sm:p-8">
                <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="soft-chip">AI 采访式复盘</span>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">开始复盘</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">AI 会根据当前这条项目经历生成 3 到 5 条采访式问题，问答记录会挂在这条经历下。</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateQuestions}
                    disabled={isGeneratingQuestions || !selectedId}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isGeneratingQuestions ? "正在生成问题..." : "开始复盘"}
                  </button>
                </div>

                {questionError ? <ErrorDisplay error={questionError} compact /> : null}
                {isGeneratingQuestions ? <GeneratingIndicator label="AI 正在生成采访问题" /> : null}

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
                          className="mt-4 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
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
                    <span className="soft-chip">复盘记录</span>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">已保存问答</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">这条项目经历下的问答时间线，刷新后仍会保留。</p>
                  </div>
                </div>

                {timelineError ? <ErrorDisplay error={timelineError} compact /> : null}

                <p className="mt-4 text-sm leading-7 text-slate-600">{timelineMessage}</p>

                {timeline.length === 0 ? (
                  <div className="mt-6 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 px-5 py-8 text-sm leading-7 text-slate-600">
                    还没有已保存的复盘问答。先在上方生成首轮问题，回答其中一条并点击“保存这一问答”，这里就会出现时间线。
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {timeline.map((item) => (
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
          ) : (
            <div className="page-card border-dashed p-8 text-center text-sm leading-7 text-slate-500">
              {materials.length > 0
                ? "在左侧选择一条项目经历，即可编辑内容或进行 AI 采访式复盘。"
                : "点击左侧「新建项目经历」录入第一条素材。"}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
