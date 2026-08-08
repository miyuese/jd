import Link from "next/link";
import { NewProjectWorkspace } from "@/components/new-project-workspace";
import { ProjectListSection } from "@/components/project-list-section";
import { navItems } from "@/lib/navigation";

const quickEntryItems = navItems.filter((item) => item.href !== "/workspace").slice(0, 6);

const flowSteps = [
  {
    step: "①",
    title: "新建项目",
    description: "填写项目名称与目标岗位",
    href: "/workspace"
  },
  {
    step: "②",
    title: "录入材料 + AI 复盘",
    description: "简历材料 / 项目材料 → 项目卡片确认",
    href: "/project-card"
  },
  {
    step: "③",
    title: "JD 解析 + 匹配分析",
    description: "粘贴目标 JD → 能力摘要 → 匹配点/差距点",
    href: "/jd-analysis"
  },
  {
    step: "④",
    title: "简历改写 + 面试准备",
    description: "生成贴合 JD 的简历与面试讲稿",
    href: "/resume-rewrite"
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
      <section className="page-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary-100/90 via-transparent to-teal-100/70" />
        <div className="relative">
          <span className="soft-chip">工作台</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            管理你的求职项目，完成从项目复盘到面试准备的完整流程。
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-sm text-primary-700">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              我的项目：{projectCount} 个
            </span>
          </div>
        </div>
      </section>

      <NewProjectWorkspace />

      <section className="page-card p-6 sm:p-8">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="section-title">推荐使用流程</h2>
          <p className="section-copy mt-2">按这个顺序走，每个模块的依赖关系就理顺了。材料越完整，AI 生成的结果越可信。</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flowSteps.map((flow) => (
            <Link
              key={flow.title}
              href={flow.href}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-sm text-primary-700">
                  {flow.step}
                </span>
                <span className="text-sm font-medium text-slate-900">{flow.title}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{flow.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <ProjectListSection projects={projects} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickEntryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="page-card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xl transition group-hover:bg-primary-100">
              {item.icon}
            </span>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900">{item.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
