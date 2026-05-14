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
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project-card?projectId=${project.id}`}
              className="block rounded-lg border border-slate-100 p-4 transition hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{project.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{project.targetRole}</p>
                </div>
                <span className="text-xs text-slate-400">{formatDate(project.createdAt)}</span>
              </div>
              {project.currentNeed && (
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{project.currentNeed}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
