import Link from "next/link";
import { NewProjectWorkspace } from "@/components/new-project-workspace";
import { ProjectListSection } from "@/components/project-list-section";
import { navItems } from "@/lib/navigation";

const quickEntryItems = navItems.filter((item) => item.href !== "/workspace").slice(0, 6);

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
