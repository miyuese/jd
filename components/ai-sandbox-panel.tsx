"use client";

import { useState } from "react";

type AiSandboxPanelProps = {
  isConfigured: boolean;
  missingKeys: string[];
  baseURL: string;
  model: string;
  providerName: string;
};

const examplePrompts = [
  "请用 3 句话解释什么是 AI 产品经理。",
  "请帮我把下面这段话改写得更适合面试自我介绍开头。",
  "请给我 5 个用于测试模型接口是否正常的中文提问示例。"
];

export function AiSandboxPanel({
  isConfigured,
  missingKeys,
  baseURL,
  model,
  providerName
}: AiSandboxPanelProps) {
  const [prompt, setPrompt] = useState(examplePrompts[0]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [responseModel, setResponseModel] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      setError("请输入一段测试问题后再提交。");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/ai-sandbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });

      const data = (await response.json()) as {
        text?: string;
        model?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "AI 沙盒调用失败，请稍后再试。");
      }

      setResult(data.text ?? "");
      setResponseModel(data.model ?? "");
    } catch (err) {
      setResult("");
      setResponseModel("");
      setError(err instanceof Error ? err.message : "AI 沙盒调用失败，请稍后再试。");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="soft-chip">Quest 3.2 · AI 模型沙盒</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">最小 AI 调用链路验证</h1>
            <p className="mt-3 text-sm leading-8 text-slate-600 sm:text-base">
              这个页面只做一件事：输入一句测试问题，确认 OpenAI-compatible 模型接口能稳定返回文本结果。
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white/85 px-4 py-4 text-sm shadow-sm">
            <div className="text-xs text-slate-500">当前状态</div>
            <div className="mt-1 font-medium text-slate-900">{isConfigured ? "已检测到 AI 配置" : "等待补齐 AI 配置"}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <form className="page-card p-6 sm:p-8" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
              <div>
                <h2 className="section-title">单轮测试输入</h2>
                <p className="section-copy mt-2">当前只验证一次输入对应一次输出，不保存上下文，不做业务提示词。</p>
              </div>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                POST /api/ai-sandbox
              </span>
            </div>

            <textarea
              rows={8}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="输入一句测试问题，例如：请概括 AI 产品经理和技术产品经理的区别。"
              className="mt-6 w-full rounded-[24px] border border-sky-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {examplePrompts.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPrompt(item)}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:border-sky-300"
                >
                  使用示例
                </button>
              ))}
            </div>

            {!isConfigured ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm leading-7 text-slate-700">
                当前还不能真实调用模型。请先在 `.env.local` 中补齐：{missingKeys.join("、")}。
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-sky-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">提交后应该在合理时间内返回一段模型文本，而不是空白或报错。</p>
              <button
                type="submit"
                disabled={status === "loading" || !isConfigured}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {status === "loading" ? "正在调用模型..." : "发送测试问题"}
              </button>
            </div>
          </form>

          <div className="page-card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-4">
              <div>
                <h2 className="section-title">模型返回结果</h2>
                <p className="section-copy mt-2">如果配置正确，这里会显示模型真实返回的一段文本。</p>
              </div>
              <span className="soft-chip">单轮输出</span>
            </div>

            <div className="mt-6 rounded-[24px] bg-slate-50/80 p-5 text-sm leading-8 text-slate-700">
              {error ? (
                <div className="text-rose-600">{error}</div>
              ) : result ? (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap">{result}</div>
                  <div className="border-t border-sky-100 pt-3 text-xs text-slate-500">
                    返回模型：{responseModel || model || "未返回模型标识"}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">还没有模型返回结果。先输入一段问题并提交，这里会显示真实响应内容。</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">配置检查</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Provider</div>
                <div className="mt-1 font-medium text-slate-900">{providerName}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Base URL</div>
                <div className="mt-1 break-all font-medium text-slate-900">{baseURL || "未配置"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Model</div>
                <div className="mt-1 break-all font-medium text-slate-900">{model || "未配置"}</div>
              </div>
            </div>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">推荐配置示例</h3>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-7 text-slate-700">
{`AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=你的密钥
AI_MODEL=gpt-4o-mini
AI_PROVIDER_NAME=openai-compatible`}
            </pre>
          </div>

          <div className="page-card p-5">
            <h3 className="text-lg font-semibold text-slate-900">验收关注点</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <div className="rounded-2xl bg-sky-50/70 px-4 py-3">第一次提问应在合理时间内返回文本，而不是报错或空白。</div>
              <div className="rounded-2xl bg-sky-50/70 px-4 py-3">修改输入内容再次提交，返回结果应发生变化。</div>
              <div className="rounded-2xl bg-sky-50/70 px-4 py-3">当前只验证模型连通性，不保存聊天记录，也不接业务提示词。</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
