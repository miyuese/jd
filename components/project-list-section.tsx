import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

type ProjectListItem = {
  id: string;
  name: string;
  targetRole: string;
  currentNeed: string;
  status: string;
  createdAt: Date;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function ProjectListSection({ projects }: { projects: ProjectListItem[] }) {
  return (
    <section className="page-card p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-semibold text-slate-900">我的项目</h2>
          <p className="mt-1 text-sm text-slate-500">点击项目可查看详情</p>
        </div>
        <span className="text-sm text-slate-400">{projects.length} 个</span>
      </div>

      {projects.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="还没有项目"
            description="创建你的第一个项目，开始整理项目经历。"
            action={{ label: "创建项目", href: "#new-project" }}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {projects.map((project, index) => {
            const iconTones = [
              "bg-primary-100 text-primary-700",
              "bg-teal-100 text-teal-700",
              "bg-amber-100 text-amber-700",
              "bg-pink-100 text-pink-700"
            ];

            return (
              <Link
                key={project.id}
                href={`/project-card?projectId=${project.id}`}
                className="group flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-medium ${iconTones[index % iconTones.length]}`}>
                  {project.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-slate-900">{project.name}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">{project.targetRole}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
                      {formatDate(project.createdAt)}
                    </span>
                  </div>
                  {project.currentNeed && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{project.currentNeed}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
