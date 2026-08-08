"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createProjectAction } from "@/app/workspace/actions";
import { defaultProjectFormValues, projectFormSchema, type ProjectFormValues } from "@/lib/project-form";

const draftStorageKey = "jd-helper:workspace-draft";
const submitStorageKey = "jd-helper:workspace-submit";

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未提交";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function NewProjectWorkspace() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaultProjectFormValues
  });

  const liveDraft = form.watch();
  const [hydrated, setHydrated] = useState(false);
  const [submittedProject, setSubmittedProject] = useState<ProjectFormValues | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState(
    "填写左侧表单并提交后，这里会显示保存结果。"
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);

    try {
      const savedDraft = window.localStorage.getItem(draftStorageKey);
      const savedSubmission = window.localStorage.getItem(submitStorageKey);

      if (savedDraft) {
        form.reset({
          ...defaultProjectFormValues,
          ...JSON.parse(savedDraft)
        });
      }

      if (savedSubmission) {
        const parsed = JSON.parse(savedSubmission) as {
          values?: ProjectFormValues;
          submittedAt?: string;
        };

        if (parsed.values) {
          setSubmittedProject(parsed.values);
        }

        if (parsed.submittedAt) {
          setSubmittedAt(parsed.submittedAt);
        }
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      window.localStorage.removeItem(submitStorageKey);
    }
  }, [form]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const subscription = form.watch((value) => {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          ...defaultProjectFormValues,
          ...value
        })
      );
    });

    return () => subscription.unsubscribe();
  }, [form, hydrated]);

  const handleCreateProject = (values: ProjectFormValues) => {
    setSubmitError(null);

    startTransition(async () => {
      const result = await createProjectAction(values);

      if (!result.success) {
        setSubmitError(result.message);
        return;
      }

      const nextSubmittedAt = result.project.createdAt;
      setSubmittedProject(values);
      setSubmittedAt(nextSubmittedAt);
      setSubmitMessage(result.message);
      window.localStorage.setItem(
        submitStorageKey,
        JSON.stringify({
          values,
          submittedAt: nextSubmittedAt
        })
      );
      router.refresh();
    });
  };

  return (
    <section className="page-card p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-sky-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="soft-chip">项目复盘</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">新建项目复盘任务</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              填写项目基础信息，右侧会实时预览草稿。提交后项目将保存到你的工作台，之后可继续录入材料、完成 JD 分析和表达生成。
            </p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-800">
            保存到你的工作台
          </div>
        </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_340px]">
        <form className="space-y-5" onSubmit={form.handleSubmit(handleCreateProject)} noValidate>
          <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 dark:bg-slate-800/50 p-5">
            <label className="block text-sm font-medium text-slate-800" htmlFor="projectName">
              项目名称
            </label>
            <p className="mt-1 text-sm leading-6 text-slate-500">用一句话说明你要复盘的是哪个项目或经历。</p>
            <input
              id="projectName"
              type="text"
              placeholder="例如：AI 面试助手 MVP 从 0 到 1"
              className="mt-3 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              {...form.register("projectName")}
            />
            {form.formState.errors.projectName ? (
              <p className="mt-2 text-sm text-rose-500">{form.formState.errors.projectName.message}</p>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 dark:bg-slate-800/50 p-5">
            <label className="block text-sm font-medium text-slate-800" htmlFor="targetRole">
              目标岗位
            </label>
            <p className="mt-1 text-sm leading-6 text-slate-500">填写这次复盘最想对齐的岗位方向，方便后续接 JD 分析。</p>
            <input
              id="targetRole"
              type="text"
              placeholder="例如：AI 产品经理 / 技术产品经理"
              className="mt-3 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              {...form.register("targetRole")}
            />
            {form.formState.errors.targetRole ? (
              <p className="mt-2 text-sm text-rose-500">{form.formState.errors.targetRole.message}</p>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-slate-50/70 dark:bg-slate-800/50 p-5">
            <label className="block text-sm font-medium text-slate-800" htmlFor="currentNeed">
              当前需求
            </label>
            <p className="mt-1 text-sm leading-6 text-slate-500">说明你现在最想解决的问题，例如复盘、改写简历或准备面试表达。</p>
            <textarea
              id="currentNeed"
              rows={5}
              placeholder="例如：我想先把项目背景、职责和结果讲清楚，再针对 AI PM 岗位做定制化表达。"
              className="mt-3 w-full rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm leading-7 text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              {...form.register("currentNeed")}
            />
            {form.formState.errors.currentNeed ? (
              <p className="mt-2 text-sm text-rose-500">{form.formState.errors.currentNeed.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-sky-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-500">提交后项目会保存到你的工作台，随时可以回来继续完善。</p>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(83,74,183,0.9)] transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
              {isPending ? "正在保存..." : "保存项目"}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-sky-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">项目草稿预览</h3>
              <span className="soft-chip">实时同步</span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-sky-50/70 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-sky-700">项目名称</div>
                <div className="mt-2 text-base font-medium text-slate-900">
                  {liveDraft.projectName || "等待填写项目名称"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">目标岗位</div>
                <div className="mt-2 text-sm leading-7 text-slate-700">
                  {liveDraft.targetRole || "等待填写目标岗位"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">当前需求</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {liveDraft.currentNeed || "等待填写当前需求"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">保存状态</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">{submitMessage}</p>

            {submitError ? <p className="mt-3 text-sm text-rose-500">{submitError}</p> : null}

            <div className="mt-4 space-y-3 rounded-2xl bg-white/85 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">最近保存</span>
                <span className="font-medium text-slate-900">{formatDateTime(submittedAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">状态</span>
                <span className="font-medium text-sky-700">{submittedProject ? "已保存到工作台" : "等待提交"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
