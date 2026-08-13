import Link from "next/link";
import { ArrowUpRight, PenLine, Plus, ScanSearch, Upload } from "lucide-react";
import { NewProjectWorkspace } from "@/components/new-project-workspace";
import { ProjectListSection } from "@/components/project-list-section";
import { Reveal } from "@/components/fx/reveal";
import { navItems } from "@/lib/navigation";

const quickEntryItems = navItems.filter((item) => item.href !== "/workspace").slice(0, 6);

const flowSteps = [
  {
    index: "01",
    title: "新建项目",
    description: "填写项目名称与目标岗位",
    href: "/workspace",
    icon: Plus
  },
  {
    index: "02",
    title: "录入材料 + AI 复盘",
    description: "简历材料 / 项目材料 → 项目卡片确认",
    href: "/project-card",
    icon: Upload
  },
  {
    index: "03",
    title: "JD 解析 + 匹配分析",
    description: "粘贴目标 JD → 能力摘要 → 匹配点/差距点",
    href: "/jd-analysis",
    icon: ScanSearch
  },
  {
    index: "04",
    title: "简历改写 + 面试准备",
    description: "生成贴合 JD 的简历与面试讲稿",
    href: "/resume-rewrite",
    icon: PenLine
  }
];

type WorkspacePageProps = {
  projectCount: number;
  projects: Array<{
    id: string;
    name: string;
    targetRole: string;
    currentNeed: string;
    status: string;
    createdAt: Date;
  }>;
};

export function WorkspacePage({ projectCount, projects }: WorkspacePageProps) {
  return (
    <>
      {/* 头部 */}
      <section className="page-card relative overflow-hidden p-6 sm:p-9">
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_62%)]"
          aria-hidden
        />
        <div className="relative">
          <div className="eyebrow">Workspace</div>
          <h1 className="display-lg mt-4 text-[var(--ink)]">工作台</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
            管理你的求职项目，完成从项目复盘到面试准备的完整流程。
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-soft)] bg-[var(--brand-soft)] px-3.5 py-1.5 text-sm font-semibold text-[var(--brand)]">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              我的项目：{projectCount} 个
            </span>
          </div>
        </div>
      </section>

      <NewProjectWorkspace />

      {/* 推荐流程 */}
      <section className="page-card p-6 sm:p-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-5">
            <div>
              <h2 className="section-title !text-xl">推荐使用流程</h2>
              <p className="section-copy mt-1.5">
                按这个顺序走，每个模块的依赖关系就理顺了。材料越完整，AI 生成的结果越可信。
              </p>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--ink-faint)]">
              Order Matters
            </span>
          </div>
        </Reveal>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flowSteps.map((flow, index) => (
            <Reveal key={flow.title} delay={index * 70}>
              <Link
                href={flow.href}
                className="group relative block overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-deep)]/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white">
                    <flow.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="text-stroke font-bold !text-2xl opacity-40 transition-opacity group-hover:opacity-80">
                    {flow.index}
                  </span>
                </div>
                <div className="mt-4 text-sm font-semibold text-[var(--ink)]">{flow.title}</div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--ink-soft)]">{flow.description}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <ProjectListSection projects={projects} />

      {/* 快捷入口 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickEntryItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.href} delay={index * 50}>
              <Link
                href={item.href}
                className="page-card group flex items-start gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-soft)] hover:shadow-[0_24px_48px_-28px_var(--glow)]"
              >
                <span className="icon-circle h-11 w-11 !rounded-xl">
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-[var(--ink)]">{item.label}</h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-all duration-300 group-hover:rotate-45 group-hover:text-[var(--brand)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.description}</p>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </section>
    </>
  );
}
