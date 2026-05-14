"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type MaterialEditorProps = {
  badge: string;
  title: string;
  description: string;
  placeholder: string;
  storageKey: string;
  saveLabel: string;
  helperTitle: string;
  helperPoints: string[];
  previewTitle: string;
  previewEmpty: string;
};

type MaterialFormValues = {
  content: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未手动保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function MaterialEditor({
  badge,
  title,
  description,
  placeholder,
  storageKey,
  saveLabel,
  helperTitle,
  helperPoints,
  previewTitle,
  previewEmpty
}: MaterialEditorProps) {
  const savedAtStorageKey = `${storageKey}:savedAt`;
  const form = useForm<MaterialFormValues>({
    defaultValues: {
      content: ""
    }
  });
  const content = form.watch("content");
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);

    try {
      const savedContent = window.localStorage.getItem(storageKey);
      const savedTime = window.localStorage.getItem(savedAtStorageKey);

      if (savedContent) {
        form.reset({ content: savedContent });
      }

      if (savedTime) {
        setSavedAt(savedTime);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(savedAtStorageKey);
    }
  }, [form, savedAtStorageKey, storageKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const subscription = form.watch((value) => {
      window.localStorage.setItem(storageKey, value.content ?? "");
    });

    return () => subscription.unsubscribe();
  }, [form, hydrated, storageKey]);

  const handleSave = (values: MaterialFormValues) => {
    const nextSavedAt = new Date().toISOString();
    window.localStorage.setItem(storageKey, values.content);
    window.localStorage.setItem(savedAtStorageKey, nextSavedAt);
    setSavedAt(nextSavedAt);
  };

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative">
          <span className="soft-chip">{badge}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="page-card p-6 sm:p-8" onSubmit={form.handleSubmit(handleSave)}>
          <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
            <div>
              <h2 className="section-title">可编辑文本输入区</h2>
              <p className="section-copy mt-2">当前阶段只做纯文本录入与本地保存，不接文件上传、不接数据库。</p>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
              本地草稿
            </span>
          </div>

          <textarea
            rows={18}
            placeholder={placeholder}
            className="mt-6 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            {...form.register("content")}
          />

          <div className="mt-4 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">字数：{content.trim().length} · 最近手动保存：{formatDateTime(savedAt)}</div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200"
            >
              {saveLabel}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">{helperTitle}</h3>
            <div className="mt-4 space-y-3">
              {helperPoints.map((point) => (
                <div key={point} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">{previewTitle}</h3>
            <div className="mt-4 rounded-2xl bg-sky-50/70 p-4 text-sm leading-7 text-slate-700">
              {content.trim() ? content : previewEmpty}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">本地状态</span>
              <span className="font-medium text-sky-700">{content.trim() ? "已录入内容" : "等待粘贴"}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
