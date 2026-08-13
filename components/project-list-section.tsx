import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
    <section className="page-card p-6 sm:p-8">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <div>
          <h2 className="section-title !text-xl">我的项目</h2>
          <p className="section-copy mt-1.5">点击项目可查看详情</p>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-[var(--bg-deep)]/50 px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]">
          {projects.length} 个
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="还没有项目"
            description="创建你的第一个项目，开始整理项目经历。"
            action={{ label: "创建项目", href: "#new-project" }}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {projects.map((project, index) => {
            const iconTones = [
              "bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))] text-white",
              "bg-[linear-gradient(135deg,#0ea5a4,#059669)] text-white",
              "bg-[linear-gradient(135deg,#d97706,#dc2626)] text-white",
              "bg-[linear-gradient(135deg,#db2777,#9333ea)] text-white"
            ];

            return (
              <Link
                key={project.id}
                href={`/project-card?projectId=${project.id}`}
                className="group flex items-start gap-4 rounded-3xl border border-[var(--line)] bg-[var(--bg-deep)]/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand-soft)] hover:bg-[var(--brand-soft)] hover:shadow-[0_20px_40px_-28px_var(--glow)]"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-[0_10px_22px_-12px_var(--glow)] ${iconTones[index % iconTones.length]}`}
                >
                  {project.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[var(--ink)]">{project.name}</h3>
                      <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{project.targetRole}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink-faint)]">
                      {formatDate(project.createdAt)}
                    </span>
                  </div>
                  {project.currentNeed && (
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)] line-clamp-2">
                      {project.currentNeed}
                    </p>
                  )}
                </div>
                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-[var(--ink-faint)] transition-all duration-300 group-hover:rotate-45 group-hover:text-[var(--brand)]" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
