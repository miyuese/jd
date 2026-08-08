import type { ReactNode } from "react";

const heroFeatures = [
  {
    icon: "🛡️",
    label: "事实可信",
    tone: "bg-white/15"
  },
  {
    icon: "🎯",
    label: "岗位贴合",
    tone: "bg-white/15"
  },
  {
    icon: "🔗",
    label: "可溯源",
    tone: "bg-white/15"
  }
];

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
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-stretch">
      <div className="relative hidden overflow-hidden rounded-[32px] bg-gradient-to-br from-primary-700 via-primary-600 to-accent-600 p-8 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {badge}
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight">
            把真实经历，讲成岗位听得懂的表达。
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/80">
            从材料录入到面试准备，AI 全程基于你的真实经历做复盘、匹配和改写，不编造、可溯源、经得起追问。
          </p>
        </div>

        <div className="relative mt-10 space-y-3">
          {heroFeatures.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-4 rounded-3xl bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg">
                {feature.icon}
              </span>
              <span className="text-sm font-medium text-white/95">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="page-card flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white">
              J
            </span>
            <span className="text-lg font-semibold text-slate-900">JD 助手</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
