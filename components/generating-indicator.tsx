"use client";

// AI 生成进行中的提示占位：明确告知等待时间，避免用户误以为卡死
export function GeneratingIndicator({ label = "AI 正在生成" }: { label?: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-sky-700">
      <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
      <span>
        {label}，预计需要 10-30 秒。期间请勿刷新或关闭页面，完成后内容会自动出现。
      </span>
    </div>
  );
}
