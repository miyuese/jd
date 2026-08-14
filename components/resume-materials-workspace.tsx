"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { saveResumeMaterialAction } from "@/app/resume-materials/actions";
import { FileUpload } from "@/components/file-upload";

type ResumeMaterialsWorkspaceProps = {
  initialContent: string;
  savedAt: string | null;
  materials: Array<{
    id: string;
    title: string;
    preview: string;
    fullText: string;
    updatedAt: string;
  }>;
};

type ResumeMaterialFormValues = {
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

export function ResumeMaterialsWorkspace({ initialContent, savedAt, materials }: ResumeMaterialsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitMessage, setSubmitMessage] = useState(
    initialContent
      ? "当前数据库中已存在一份简历内容，保存会新增一个版本，旧版本仍可在左侧回看。"
      : "当前还没有保存过简历。粘贴内容或上传文件并保存后，刷新页面仍会保留。"
  );
  const [submitError, setSubmitError] = useState("");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(savedAt);
  const form = useForm<ResumeMaterialFormValues>({
    defaultValues: {
      content: initialContent
    }
  });
  const content = form.watch("content");

  useEffect(() => {
    form.reset({ content: initialContent });
    setLatestSavedAt(savedAt);
    setSubmitError("");
    setSubmitMessage(
      initialContent
        ? "当前数据库中已存在一份简历内容，保存会新增一个版本，旧版本仍可在左侧回看。"
        : "当前还没有保存过简历。粘贴内容或上传文件并保存后，刷新页面仍会保留。"
    );
  }, [form, initialContent, savedAt]);

  const handleSave = (values: ResumeMaterialFormValues) => {
    setSubmitError("");

    startTransition(async () => {
      const result = await saveResumeMaterialAction(values.content);

      if (!result.success) {
        setSubmitError(result.message);
        return;
      }

      setSubmitMessage(result.message);
      setLatestSavedAt(result.savedAt ?? new Date().toISOString());
      router.refresh();
    });
  };

  const handleFileTextExtracted = (text: string, fileName: string) => {
    form.setValue("content", text);
    setSubmitMessage(`已从文件「${fileName}」提取文字内容，可以继续编辑后保存到数据库。`);
  };

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative">
          <span className="soft-chip">简历库</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">你的简历</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            保存当前简历正文，作为后续 JD 定制改写的原始上下文。支持手动粘贴，或上传 .docx / .pdf 文件自动提取文字。
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="page-card p-6 sm:p-8" onSubmit={form.handleSubmit(handleSave)}>
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
            <div>
              <h2 className="section-title">简历内容</h2>
              <p className="section-copy mt-2">保存后随时可回读，刷新页面仍会保留最新版本。</p>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
              自动保存
            </span>
          </div>

          <div className="mt-6">
            <FileUpload onTextExtracted={handleFileTextExtracted} />
          </div>

          <textarea
            rows={18}
            placeholder="例如：负责搭建某 AI 产品功能闭环，完成需求拆解、数据分析、上线协同与效果复盘......"
            className="mt-4 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            {...form.register("content")}
          />

          {submitError ? <p className="mt-3 text-sm text-rose-500">{submitError}</p> : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              字数：{content.trim().length} · 最近保存：{formatDateTime(latestSavedAt)}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(83,74,183,0.9)] transition hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
              {isPending ? "正在保存..." : "保存简历"}
            </button>
          </div>
        </form>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">历史版本</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">每次保存会新增一个版本，旧版本不覆盖。点击可回看当时内容。</p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {materials.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">还没有保存过简历版本。</p>
              ) : (
                materials.map((item) => {
                  const isActive = item.updatedAt === latestSavedAt;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        form.setValue("content", item.fullText);
                        setSubmitMessage("已回看历史版本，可复制内容，或在其基础上编辑后保存为新版本。");
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-sky-300 bg-sky-50" : "border-slate-100 bg-white hover:border-sky-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{item.title}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatDateTime(item.updatedAt)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.preview || "（空内容）"}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">这份简历的用途</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">作为 JD 定制改写前的原始上下文。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">同步沉淀进个人记忆库，参与能力画像。</div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">支持上传 .docx 或 .pdf 自动提取文字。</div>
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">保存结果</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{submitMessage}</p>
            <div className="mt-4 rounded-2xl bg-sky-50/70 p-4 text-sm leading-7 text-slate-700">
              {content.trim()
                ? content
                : "还没有录入简历内容。把当前简历原文贴进来，保存后这里会显示。"}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
