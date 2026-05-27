"use client";

import { categorizeError, type ErrorCategory } from "@/lib/error-handler";

type ErrorDisplayProps = {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
};

const categoryIcons: Record<ErrorCategory, string> = {
  ai: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
  database: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
  file: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  auth: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
  validation: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  network: "M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z",
  unknown: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
};

const categoryColors: Record<ErrorCategory, { bg: string; border: string; icon: string; text: string }> = {
  ai: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-500", text: "text-purple-800" },
  database: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", text: "text-amber-800" },
  file: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-500", text: "text-orange-800" },
  auth: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-500", text: "text-red-800" },
  validation: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "text-yellow-500", text: "text-yellow-800" },
  network: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-500", text: "text-blue-800" },
  unknown: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", text: "text-slate-800" }
};

export function ErrorDisplay({ error, onRetry, compact = false }: ErrorDisplayProps) {
  const categorized = categorizeError(error);
  const colors = categoryColors[categorized.category];
  const iconPath = categoryIcons[categorized.category];

  if (compact) {
    return (
      <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-start gap-3">
          <svg className={`h-5 w-5 ${colors.icon} mt-0.5 shrink-0`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${colors.text}`}>{categorized.message}</p>
            <p className="mt-1 text-xs text-slate-600">{categorized.suggestion}</p>
            {categorized.message !== (error instanceof Error ? error.message : String(error)) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">查看详细错误信息</summary>
                <p className="mt-2 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600">{error instanceof Error ? error.message : String(error)}</p>
              </details>
            )}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[24px] border ${colors.border} ${colors.bg} p-6`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
          <svg className={`h-6 w-6 ${colors.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${colors.text}`}>{categorized.message}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{categorized.suggestion}</p>
          {categorized.message !== (error instanceof Error ? error.message : String(error)) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">查看详细错误信息</summary>
              <p className="mt-2 rounded-xl bg-white/80 p-3 text-xs text-slate-600">{error instanceof Error ? error.message : String(error)}</p>
            </details>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              重新尝试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
