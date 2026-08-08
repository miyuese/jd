import Link from "next/link";
import { hasClerkCredentials } from "@/lib/clerk-env";

const steps = [
  {
    title: "录入真实材料",
    description: "导入已有简历、项目原始材料和目标岗位信息，搭出可信的求职素材底座。",
    icon: "📥",
    tone: "bg-primary-50 text-primary-700"
  },
  {
    title: "AI 采访式复盘",
    description: "围绕目标岗位逐轮追问背景、职责、决策和结果，把零散经历整理成能站得住的项目认知。",
    icon: "💬",
    tone: "bg-teal-50 text-teal-700"
  },
  {
    title: "生成岗位化表达",
    description: "在确认事实之后，完成 JD 匹配、简历改写和面试准备，让每一句输出都有证据可依。",
    icon: "✨",
    tone: "bg-amber-50 text-amber-700"
  }
];

const capabilities = [
  {
    label: "事实可信",
    value: "AI 不编造经历",
    icon: "🛡️",
    tone: "bg-primary-50 text-primary-700"
  },
  {
    label: "岗位贴合",
    value: "按 JD 定制表达",
    icon: "🎯",
    tone: "bg-teal-50 text-teal-700"
  },
  {
    label: "可溯源",
    value: "句句有证据",
    icon: "🔗",
    tone: "bg-amber-50 text-amber-700"
  }
];

export function LandingPage() {
  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8 lg:p-12 fade-up">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(143,131,224,0.22),transparent_55%)] lg:block" />
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary-100/60 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-center">
          <div className="max-w-3xl">
            <span className="soft-chip">AI 求职工作台</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              把真实经历，讲成岗位听得懂的表达。
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
              从材料录入到面试准备，AI 全程基于你的真实经历做复盘、匹配和改写，不编造、可溯源、经得起追问。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={hasClerkCredentials ? "/sign-up" : "/workspace"}
                className="btn-primary"
              >
                {hasClerkCredentials ? "注册并开始使用" : "进入工作台"}
              </Link>
              <Link
                href={hasClerkCredentials ? "/sign-in" : "/resume-materials"}
                className="btn-secondary"
              >
                {hasClerkCredentials ? "已有账号，去登录" : "从简历材料开始"}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm backdrop-blur transition-colors duration-200 dark:border-slate-700/60 dark:bg-slate-900/70">
            <div className="text-xs uppercase tracking-[0.22em] text-primary-600">核心能力</div>
            <div className="mt-4 space-y-3">
              {capabilities.map((capability) => (
                <div
                  key={capability.label}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-primary-200 hover:bg-primary-50/50 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${capability.tone}`}>
                    {capability.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{capability.label}</div>
                    <div className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">{capability.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={[
              "page-card group p-6 transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg fade-up",
              index === 0 ? "fade-up-delay-1" : index === 1 ? "fade-up-delay-2" : "fade-up-delay-3"
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full text-xl transition-transform duration-300 group-hover:scale-110 ${step.tone}`}>
                {step.icon}
              </span>
              <span className="text-2xl font-semibold text-slate-200 transition group-hover:text-primary-200">
                0{index + 1}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{step.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
