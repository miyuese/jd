import type { ReactNode } from "react";

export function AuthPageShell({
  badge,
  title,
  description,
  children
}: {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
      <div className="page-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100/90 via-transparent to-cyan-100/70" />
        <div className="relative max-w-2xl">
          <span className="soft-chip">{badge}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm leading-8 text-slate-600">{description}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-sky-50/80 p-4">
              <div className="text-xs text-slate-500">登录后</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">进入工作台</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">退出后</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">回到公开首页</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-card p-4 sm:p-6">{children}</div>
    </section>
  );
}
