import Link from "next/link";
import { hasClerkCredentials } from "@/lib/clerk-env";

const steps = [
  {
    title: "录入真实材料",
    description: "先把已有简历、项目原始材料和目标岗位信息收进来，搭出后续复盘的事实底座。"
  },
  {
    title: "AI 采访式追问",
    description: "围绕目标岗位继续追问背景、职责、决策和结果，把零散信息变成能站得住的项目认知。"
  },
  {
    title: "生成岗位化表达",
    description: "在确认事实后再做 JD 匹配、简历改写和面试表达，降低虚构和跑偏风险。"
  }
];

export function LandingPage() {
  return (
    <>
      <section className="page-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.28),transparent_55%)] lg:block" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-center">
          <div className="max-w-3xl">
            <span className="soft-chip">Quest 3.1 · 登录流程接入</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              先登录，再进入你的求职表达工作台。
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">
              当前版本已经完成产品骨架和录入闭环。现在补上注册、登录和退出，把原型升级成真正面向用户的工作台入口。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={hasClerkCredentials ? "/sign-up" : "/workspace"}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(2,132,199,0.85)] transition hover:bg-sky-700"
              >
                {hasClerkCredentials ? "注册并开始使用" : "先继续查看工作台"}
              </Link>
              <Link
                href={hasClerkCredentials ? "/sign-in" : "/resume-materials"}
                className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-medium text-sky-700 transition hover:border-sky-300"
              >
                {hasClerkCredentials ? "已有账号，去登录" : "查看材料录入模块"}
              </Link>
            </div>

            {!hasClerkCredentials ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm leading-7 text-slate-700">
                尚未检测到 Clerk 环境变量。页面结构和认证入口已接好，补齐 `.env.local` 后即可启用真实注册与登录流程。
              </div>
            ) : null}
          </div>

          <div className="page-card p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-sky-700">当前版本能力</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-sky-50/80 p-4">
                <div className="text-xs text-slate-500">公开首页</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">已独立开放</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">登录后主页</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">工作台</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">保护范围</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">8 个业务入口</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="page-card p-5">
            <div className="text-sm font-medium text-sky-700">0{index + 1}</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
