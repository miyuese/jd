"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetAiConfigAction,
  saveAiConfigAction,
  testAiConnectionAction
} from "@/app/settings/actions";

type SettingsWorkspaceProps = {
  configured: boolean;
  isOwner: boolean;
  initialProviderName: string;
  initialBaseURL: string;
  initialApiKeyMasked: string;
  initialPrimaryModel: string;
  initialFallbackModels: string[];
  envModel: string;
  envBaseURL: string;
  envConfigured: boolean;
};

export function SettingsWorkspace({
  configured,
  isOwner,
  initialProviderName,
  initialBaseURL,
  initialApiKeyMasked,
  initialPrimaryModel,
  initialFallbackModels,
  envModel,
  envBaseURL,
  envConfigured
}: SettingsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);

  const [providerName, setProviderName] = useState(initialProviderName);
  const [baseURL, setBaseURL] = useState(initialBaseURL);
  const [apiKey, setApiKey] = useState("");
  const [primaryModel, setPrimaryModel] = useState(initialPrimaryModel);
  const [fallbackModels, setFallbackModels] = useState(initialFallbackModels.join(", "));

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const notify = (successMessage: string, errorMessage: string, ok: boolean) => {
    setMessage(ok ? successMessage : "");
    setError(ok ? "" : errorMessage);
  };

  const handleSave = () => {
    if (!baseURL.trim()) {
      setError("接口地址（baseURL）不能为空。");
      return;
    }

    if (!primaryModel.trim()) {
      setError("主模型不能为空。");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveAiConfigAction({
          providerName: providerName.trim() || undefined,
          baseURL: baseURL.trim(),
          apiKey: apiKey.trim() || undefined,
          primaryModel: primaryModel.trim(),
          fallbackModels: fallbackModels.trim() || undefined
        });
        notify(result.message, result.message, result.success);
        if (result.success) {
          setApiKey("");
        }
        router.refresh();
      } catch (err) {
        notify("", err instanceof Error ? err.message : "保存失败，请稍后再试。", false);
      }
    });
  };

  const handleTest = () => {
    if (!baseURL.trim() || !primaryModel.trim()) {
      setError("请先填写接口地址和主模型，再测试连接。");
      return;
    }

    setTesting(true);
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await testAiConnectionAction({
          providerName: providerName.trim() || undefined,
          baseURL: baseURL.trim(),
          apiKey: apiKey.trim() || undefined,
          model: primaryModel.trim()
        });
        notify(result.message, result.message, result.success);
      } catch (err) {
        notify("", err instanceof Error ? err.message : "连接测试失败，请稍后再试。", false);
      } finally {
        setTesting(false);
      }
    });
  };

  const handleReset = () => {
    if (!window.confirm("确定删除自定义 AI 配置，恢复为使用环境变量配置吗？")) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await resetAiConfigAction();
        notify(result.message, result.message, result.success);
        router.refresh();
      } catch (err) {
        notify("", err instanceof Error ? err.message : "重置失败，请稍后再试。", false);
      }
    });
  };

  const readOnly = configured && !isOwner;

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-slate-100/90 via-transparent to-teal-100/70" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-teal-700 text-lg text-white shadow-[0_8px_20px_-10px_rgba(15,118,110,0.9)]">
              ⚙️
            </span>
            <span className="soft-chip">模型设置</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">AI 模型配置</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
            在网站内直接切换 AI 模型，保存后立即生效，无需重新部署。配置主模型后可添加多个备用模型，主模型调用失败时自动降级，演示不翻车。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />保存即生效</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />多模型自动降级</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />Key 仅服务端可见</span>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-700">{message}</div>
      ) : null}

      {readOnly ? (
        <section className="page-card p-6">
          <div className="text-sm leading-7 text-slate-600">
            当前 AI 配置由其他账号管理，本页为只读状态。当前生效配置：
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-400">接口地址</dt>
              <dd className="mt-1 font-medium text-slate-800">{baseURL || "（未设置）"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-400">主模型</dt>
              <dd className="mt-1 font-medium text-slate-800">{primaryModel || "（未设置）"}</dd>
            </div>
            {initialFallbackModels.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <dt className="text-slate-400">备用模型</dt>
                <dd className="mt-1 font-medium text-slate-800">{initialFallbackModels.join("、")}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : (
        <section className="page-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-teal-100 pb-4">
            <div>
              <h2 className="section-title">模型配置表单</h2>
              <p className="section-copy mt-2">保存后立即生效，所有 AI 功能（复盘、JD 分析、改写、面试）都会使用这里的配置。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">接口地址（baseURL）</label>
                <input
                  value={baseURL}
                  onChange={(event) => setBaseURL(event.target.value)}
                  placeholder="https://api.xxx.com/v1"
                  disabled={readOnly}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Provider 名称（可选）</label>
                <input
                  value={providerName}
                  onChange={(event) => setProviderName(event.target.value)}
                  placeholder="openai-compatible"
                  disabled={readOnly}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                API Key {initialApiKeyMasked ? <span className="text-xs text-slate-400">（已保存：{initialApiKeyMasked}，留空表示不修改）</span> : null}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={initialApiKeyMasked ? "留空保留当前 Key" : "sk-..."}
                disabled={readOnly}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">主模型</label>
                <input
                  value={primaryModel}
                  onChange={(event) => setPrimaryModel(event.target.value)}
                  placeholder="deepseek-v4-pro"
                  disabled={readOnly}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">备用模型（逗号分隔，可选）</label>
                <input
                  value={fallbackModels}
                  onChange={(event) => setFallbackModels(event.target.value)}
                  placeholder="deepseek-v4-flash, gpt-4o-mini"
                  disabled={readOnly}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(13,148,136,0.85)] transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {isPending ? "保存中..." : "保存并生效"}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={isPending || testing}
                className="inline-flex items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-5 py-3 text-sm font-medium text-teal-700 transition hover:bg-teal-100 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
              {configured ? (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  重置为环境变量
                </button>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <section className="page-card p-6">
        <h2 className="section-title">当前生效状态</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${configured ? "bg-teal-500" : "bg-amber-400"}`} />
            <span className="text-slate-700">
              {configured ? (
                <>使用自定义配置（保存于网站内，改配置无需部署）</>
              ) : (
                <>使用环境变量配置{envConfigured ? "" : "（环境中未配置完整 AI 变量，AI 功能不可用）"}</>
              )}
            </span>
          </div>
          {!configured && envConfigured ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-500">
              环境变量：{envModel || "未设置"} @ {envBaseURL || "未设置"}
            </div>
          ) : null}
          <div className="rounded-2xl bg-slate-50 p-4 leading-7 text-slate-600">
            <div className="font-medium text-slate-800">降级机制怎么工作？</div>
            <p className="mt-2">
              每次 AI 调用会按「主模型 → 备用模型 1 → 备用模型 2」的顺序尝试，前一个失败自动切下一个。
              全部失败才会报错。演示现场模型挂了也会自动切换，不会当场卡死。
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
