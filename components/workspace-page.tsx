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
      <section className="page-card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">工作台</h1>
        <p className="mt-2 text-sm text-slate-500">
          管理你的求职项目，完成从项目复盘到面试准备的完整流程。
        </p>
        <div className="mt-4 flex items-center gap-6 text-sm text-slate-600">
          <span>我的项目：{projectCount} 个</span>
        </div>
      </section>

      <NewProjectWorkspace />

      <ProjectListSection projects={projects} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickEntryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="page-card flex items-start gap-3 p-4 transition hover:border-slate-300 hover:shadow-md"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <h3 className="font-medium text-slate-900">{item.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
