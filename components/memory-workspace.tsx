"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, CheckSquare, Square, Trash2, X } from "lucide-react";
import {
  deleteAbilityTagAction,
  deleteAbilityTagsAction,
  deleteMemorySourceAction,
  extractAbilitiesAction,
  getTagEvidenceAction,
  ingestMemoryAction,
  recordInterviewFeedbackAction,
  updateAbilityStatusAction
} from "@/app/memory/actions";
import type { AbilityCategory, MemorySourceType, TagStatus } from "@/lib/memory-data";

type SourceItem = {
  id: string;
  sourceType: MemorySourceType;
  title: string;
  rawText: string;
  createdAt: string;
};

type AbilityItem = {
  id: string;
  name: string;
  category: AbilityCategory;
  description: string;
  confidence: number;
  status: TagStatus;
  createdAt: string;
};

type MemoryWorkspaceProps = {
  initialSources: SourceItem[];
  initialAbilities: AbilityItem[];
};

type EvidenceItem = {
  chunkId: string;
  content: string;
  sourceTitle: string | null;
  sourceType: MemorySourceType | null;
};

const sourceTypeLabels: Record<MemorySourceType, string> = {
  RESUME: "简历材料",
  PROJECT_MATERIAL: "项目材料",
  INTERVIEW_ANSWER: "采访问答",
  INTERVIEW_FEEDBACK: "面试反馈",
  REFLECTION: "复盘笔记",
  MANUAL: "手动录入"
};

const categoryLabels: Record<AbilityCategory, string> = {
  PERSONA: "人物综合素质",
  GENERAL: "通用能力",
  ROLE_SPECIFIC: "特定岗位能力"
};

const categoryColors: Record<AbilityCategory, string> = {
  PERSONA: "border-amber-200 bg-amber-50 text-amber-800",
  GENERAL: "border-sky-200 bg-sky-50 text-sky-800",
  ROLE_SPECIFIC: "border-teal-200 bg-teal-50 text-teal-800"
};

const statusLabels: Record<TagStatus, string> = {
  DRAFT: "待确认",
  CONFIRMED: "已确认",
  REJECTED: "已驳回"
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function previewText(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

export function MemoryWorkspace({ initialSources, initialAbilities }: MemoryWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [abilities, setAbilities] = useState<AbilityItem[]>(initialAbilities);

  const [sourceType, setSourceType] = useState<MemorySourceType>("MANUAL");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, EvidenceItem[]>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [extractingSourceId, setExtractingSourceId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSources(initialSources);
    setAbilities(initialAbilities);
  }, [initialSources, initialAbilities]);

  const notify = (successMessage: string, errorMessage: string, ok: boolean) => {
    setMessage(ok ? successMessage : "");
    setError(ok ? "" : errorMessage);
  };

  const runAction = async <T,>(action: () => Promise<T>, onDone?: (result: T) => void) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = (await action()) as { success: boolean; message: string };
        notify(result.message, result.message, result.success);
        onDone?.(result as T);
        router.refresh();
      } catch (err) {
        notify("", err instanceof Error ? err.message : "操作失败，请稍后再试。", false);
      }
    });
  };

  const handleIngest = () => {
    if (!sourceContent.trim()) {
      setError("请先输入要存入记忆库的内容。");
      return;
    }

    runAction(
      () =>
        ingestMemoryAction({
          sourceType,
          title: sourceTitle.trim() || undefined,
          content: sourceContent
        }),
      () => {
        setSourceTitle("");
        setSourceContent("");
      }
    );
  };

  const handleExtract = (sourceId: string) => {
    setExtractingSourceId(sourceId);
    startTransition(async () => {
      try {
        const result = await extractAbilitiesAction(sourceId);
        notify(result.message, result.message, result.success);
        router.refresh();
      } catch (err) {
        notify("", err instanceof Error ? err.message : "能力标签提取失败，请稍后再试。", false);
      } finally {
        setExtractingSourceId(null);
      }
    });
  };

  const handleDeleteSource = (sourceId: string) => {
    if (!window.confirm("确定删除该记忆源吗？关联的证据片段将一并清除。")) {
      return;
    }

    runAction(() => deleteMemorySourceAction(sourceId));
  };

  const handleUpdateStatus = (tagId: string, status: TagStatus) => {
    runAction(() => updateAbilityStatusAction(tagId, status));
  };

  const handleDeleteTag = (tagId: string, tagName: string) => {
    if (!window.confirm(`确定删除能力标签「${tagName}」吗？删除后将解除与证据片段的关联，且无法恢复。`)) {
      return;
    }

    runAction(() => deleteAbilityTagAction(tagId));
  };

  const enterBatchMode = () => {
    setSelectedTagIds(new Set());
    setBatchMode(true);
  };

  const exitBatchMode = () => {
    setSelectedTagIds(new Set());
    setBatchMode(false);
  };

  const toggleTagSelected = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedTagIds((prev) => {
      const allSelected = prev.size === abilities.length;
      return allSelected ? new Set() : new Set(abilities.map((tag) => tag.id));
    });
  };

  const handleBatchDelete = () => {
    if (selectedTagIds.size === 0) {
      setError("请先勾选要删除的能力标签。");
      return;
    }

    if (!window.confirm(`确定删除选中的 ${selectedTagIds.size} 个能力标签吗？删除后将解除与证据片段的关联，且无法恢复。`)) {
      return;
    }

    const ids = Array.from(selectedTagIds);

    runAction(() => deleteAbilityTagsAction(ids), (result) => {
      if (result && (result as { success?: boolean }).success) {
        exitBatchMode();
      }
    });
  };

  const handleToggleEvidence = async (tagId: string) => {
    if (expandedEvidence[tagId]) {
      const next = { ...expandedEvidence };
      delete next[tagId];
      setExpandedEvidence(next);
      return;
    }

    setLoadingEvidenceId(tagId);
    try {
      const result = await getTagEvidenceAction(tagId);
      if (result.success && result.data) {
        setExpandedEvidence((prev) => ({
          ...prev,
          [tagId]: (result.data as { evidence: EvidenceItem[] }).evidence
        }));
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "证据查询失败，请稍后再试。");
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  const handleFeedback = () => {
    if (!feedbackContent.trim()) {
      setError("请先输入面试反馈内容。");
      return;
    }

    runAction(
      () =>
        recordInterviewFeedbackAction({
          feedbackText: feedbackContent
        }),
      () => setFeedbackContent("")
    );
  };

  const confirmedAbilities = abilities.filter((tag) => tag.status === "CONFIRMED").length;
  const pendingAbilities = abilities.filter((tag) => tag.status === "DRAFT").length;

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-teal-100/90 via-transparent to-emerald-100/70" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-[0_8px_20px_-10px_rgba(13,148,136,0.9)]">
              <Brain className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="soft-chip">个人记忆系统</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">记忆库与能力画像</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
            所有简历、项目材料、采访问答、面试反馈和复盘笔记都会沉淀为不可变证据，AI 从中提取三层能力标签（综合素质 / 通用能力 / 岗位能力），每条标签都链接证据、可点击溯源。写简历时只调用与目标 JD 匹配的标签与证据。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />证据不可变，只增不改</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />标签可确认 / 可驳回 / 可删除</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />输出句句可溯源</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-teal-700"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />面试教训回流补强</span>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-700">{message}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        {/* 材料入库 */}
        <div className="page-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-teal-100 pb-4">
            <div>
              <h2 className="section-title">材料入库</h2>
              <p className="section-copy mt-2">把任何经历材料存入记忆库，系统会自动切分为证据片段。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">材料类型</label>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as MemorySourceType)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
              >
                {(Object.keys(sourceTypeLabels) as MemorySourceType[]).map((type) => (
                  <option key={type} value={type}>
                    {sourceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">标题（可选）</label>
              <input
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="例如：XX 项目复盘 / 实习期项目材料"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">内容</label>
              <textarea
                rows={8}
                value={sourceContent}
                onChange={(event) => setSourceContent(event.target.value)}
                placeholder="粘贴项目材料、复盘笔记、简历片段等，例如：在大模型产品实习中，负责用户反馈数据分析，用 SQL 处理 10 万级行为日志，输出 3 份影响决策的洞察报告……"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 px-4 py-3 text-sm leading-7 text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
              />
            </div>

            <button
              type="button"
              onClick={handleIngest}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(13,148,136,0.85)] transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {isPending ? "正在存入记忆库..." : "存入记忆库"}
            </button>
          </div>
        </div>

        {/* 面试反馈回流 */}
        <div className="page-card p-6">
          <div className="flex items-center justify-between gap-3 border-b border-teal-100 pb-4">
            <div>
              <h2 className="section-title">面试反馈回流</h2>
              <p className="section-copy mt-2">把被追问卡住的点喂给系统，识别能力缺口，下次自动提醒补强。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">面试反馈 / 复盘</label>
              <textarea
                rows={10}
                value={feedbackContent}
                onChange={(event) => setFeedbackContent(event.target.value)}
                placeholder="例如：面试官追问推荐系统冷启动策略时，我说不清楚具体怎么解决冷启动问题的，只讲了大概思路，被追问数据规模也没答上来……"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 px-4 py-3 text-sm leading-7 text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
              />
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-sm leading-7 text-slate-600">
              <div className="font-medium text-amber-800">复盘引导：写清楚这三点，缺口识别更准</div>
              <ul className="mt-2 space-y-1.5">
                <li>1. 被追问卡住的问题是什么？</li>
                <li>2. 你当时怎么答的？卡在哪一步？</li>
                <li>3. 面试官追问了哪个细节你答不上来？</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={handleFeedback}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-full bg-amber-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(217,119,6,0.85)] transition hover:bg-amber-700 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {isPending ? "正在识别能力缺口..." : "记录反馈并提取能力缺口"}
            </button>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              <div className="font-medium text-slate-800">数据飞轮怎么转？</div>
              <p className="mt-2">
                面试反馈 → 存入记忆库 → AI 识别「能力缺口」标签 → 下次简历改写 / 面试准备时自动出现在补强建议中。用越久，画像越准。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 记忆源列表 */}
      <section className="page-card p-6">
        <div className="flex items-center justify-between gap-3 border-b border-teal-100 pb-4">
          <div>
            <h2 className="section-title">记忆源（{sources.length}）</h2>
            <p className="section-copy mt-2">所有已入库的材料。点击「提取能力标签」可让 AI 从该材料中抽取标签。</p>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 px-6 py-10 text-center text-sm text-slate-500">
            还没有记忆源。从上方「材料入库」开始，把第一份材料存进来。
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700">
                      {sourceTypeLabels[source.sourceType]}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{source.title || "未命名材料"}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(source.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExtract(source.id)}
                      disabled={isPending || extractingSourceId === source.id}
                      className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {extractingSourceId === source.id ? "提取中..." : "提取能力标签"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSource(source.id)}
                      disabled={isPending}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{previewText(source.rawText)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 能力画像 */}
      <section className="page-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 pb-4">
          <div>
            <h2 className="section-title">能力画像（{abilities.length}）</h2>
            <p className="section-copy mt-2">
              {confirmedAbilities} 个已确认 · {pendingAbilities} 个待确认。点击标签可展开证据溯源；不满意的标签可直接删除或批量管理。
            </p>
          </div>

          {batchMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                已选 {selectedTagIds.size} / {abilities.length}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={isPending}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {selectedTagIds.size === abilities.length ? "取消全选" : "全选"}
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={isPending || selectedTagIds.size === 0}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "删除中..." : `删除选中（${selectedTagIds.size}）`}
              </button>
              <button
                type="button"
                onClick={exitBatchMode}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                退出
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={enterBatchMode}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              批量管理
            </button>
          )}
        </div>

        {abilities.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 dark:bg-slate-800/50 px-6 py-10 text-center text-sm text-slate-500">
            还没有能力标签。先入库材料，再点记忆源上的「提取能力标签」。
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {(Object.keys(categoryLabels) as AbilityCategory[]).map((category) => {
              const categoryAbilities = abilities.filter((tag) => tag.category === category);

              if (categoryAbilities.length === 0) {
                return null;
              }

              return (
                <div key={category}>
                  <div className="text-sm font-medium text-slate-800">{categoryLabels[category]}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {categoryAbilities.map((tag) => (
                      <div
                        key={tag.id}
                        className={`rounded-2xl border p-4 transition ${
                          batchMode && selectedTagIds.has(tag.id)
                            ? "border-teal-300 bg-teal-50/70 ring-2 ring-teal-100"
                            : "border-slate-100 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {batchMode ? (
                              <button
                                type="button"
                                onClick={() => toggleTagSelected(tag.id)}
                                aria-label={selectedTagIds.has(tag.id) ? `取消选择 ${tag.name}` : `选择 ${tag.name}`}
                                className="shrink-0 text-slate-400 transition hover:text-teal-600"
                              >
                                {selectedTagIds.has(tag.id) ? (
                                  <CheckSquare className="h-4 w-4 text-teal-600" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
                            <span
                              className={`truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryColors[tag.category]}`}
                            >
                              {tag.name}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            置信度 {(tag.confidence * 100).toFixed(0)}% · {statusLabels[tag.status]}
                          </span>
                        </div>
                        {tag.description ? (
                          <p className="mt-3 text-sm leading-6 text-slate-500">{tag.description}</p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleEvidence(tag.id)}
                            disabled={loadingEvidenceId === tag.id}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingEvidenceId === tag.id ? "查询中..." : expandedEvidence[tag.id] ? "收起证据" : "查看证据"}
                          </button>
                          {!batchMode && tag.status !== "CONFIRMED" ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(tag.id, "CONFIRMED")}
                              disabled={isPending}
                              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              确认
                            </button>
                          ) : null}
                          {!batchMode && tag.status !== "REJECTED" ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(tag.id, "REJECTED")}
                              disabled={isPending}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              驳回
                            </button>
                          ) : null}
                          {!batchMode ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteTag(tag.id, tag.name)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          ) : null}
                        </div>

                        {expandedEvidence[tag.id] ? (
                          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
                            {expandedEvidence[tag.id].length === 0 ? (
                              <div className="text-xs leading-5 text-slate-400">
                                该标签暂无证据（来源可能已被删除）。可点击「删除」清理这个无源标签。
                              </div>
                            ) : (
                              expandedEvidence[tag.id].map((evidence) => (
                                <div key={evidence.chunkId} className="rounded-xl bg-white p-3">
                                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                                    <span>证据片段</span>
                                    {evidence.sourceTitle ? <span>· {evidence.sourceTitle}</span> : null}
                                    {evidence.sourceType ? <span>· {sourceTypeLabels[evidence.sourceType]}</span> : null}
                                  </div>
                                  <p className="text-sm leading-6 text-slate-600">{evidence.content}</p>
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
