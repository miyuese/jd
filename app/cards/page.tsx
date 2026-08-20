import type { Metadata } from "next";
import Link from "next/link";
import { requireClerkUserId } from "@/lib/auth-scope";
import { listProjectCards } from "@/lib/stage7-data";
import { Plus, ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "我的卡片"
};

export default async function CardsPage() {
  const userId = requireClerkUserId();
  const cards = await listProjectCards(userId);

  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-9">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="relative">
          <div className="eyebrow">Card Library</div>
          <h1 className="display-lg mt-4 text-[var(--ink)]">我的卡片</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
            项目卡片是「简历 × 项目经历」自由组合的产物，独立于求职计划存在。同一张卡片可以服务多个岗位。
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-soft)] bg-[var(--brand-soft)] px-3.5 py-1.5 text-sm font-semibold text-[var(--brand)]">
              共 {cards.length} 张卡片
            </span>
          </div>
        </div>
      </section>

      <section className="page-card p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5">
          <div>
            <h2 className="section-title !text-xl">卡片库</h2>
            <p className="section-copy mt-1.5">创建卡片时自由选择简历与多份项目经历，生成后用于 JD 匹配、简历改写与面试准备。</p>
          </div>
          <Link
            href="/project-card"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            新建卡片
          </Link>
        </div>

        {cards.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/65 px-5 py-10 text-center text-sm leading-7 text-slate-600">
            还没有项目卡片。
            <br />
            先到简历材料页 / 项目经历页录入素材，再回来「新建卡片」自由组合生成。
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.id}
                href={`/project-card?cardId=${card.id}`}
                className="group relative block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-deep)]/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[var(--ink)]">{card.title ?? "未命名卡片"}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-soft)]">
                      {card.background?.slice(0, 60) ?? "暂无背景描述"}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-all duration-300 group-hover:rotate-45 group-hover:text-[var(--brand)]" />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-[var(--ink-faint)]">
                  <span>
                    {card.updatedAt instanceof Date
                      ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(card.updatedAt)
                      : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {card.isCurrentProjectCard ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-700">当前最终版本</span>
                    ) : null}
                    <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5">
                      {card.status === "CONFIRMED" ? "已确认" : card.status === "PENDING_CONFIRMATION" ? "待确认" : "草稿"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
