import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileSearch,
  Link2,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Target,
  Upload
} from "lucide-react";
import { hasClerkCredentials } from "@/lib/clerk-env";
import { Marquee } from "@/components/fx/marquee";
import { Magnetic } from "@/components/fx/magnetic";
import { ParticleField } from "@/components/fx/particle-field";
import { Reveal } from "@/components/fx/reveal";
import { TiltCard } from "@/components/fx/tilt-card";

const workflow = [
  {
    index: "01",
    title: "录入真实材料",
    description: "导入已有简历、项目原始材料和目标岗位信息，搭出可信的求职素材底座。",
    href: "/resume-materials",
    icon: Upload
  },
  {
    index: "02",
    title: "AI 采访式复盘",
    description: "围绕目标岗位逐轮追问背景、职责、决策与结果，把零散经历整理成能站得住的项目认知。",
    href: "/project-card",
    icon: MessageSquare
  },
  {
    index: "03",
    title: "JD 解析与匹配",
    description: "粘贴目标 JD，得到能力摘要与匹配点/差距点，让改写有的放矢。",
    href: "/jd-analysis",
    icon: FileSearch
  },
  {
    index: "04",
    title: "生成岗位化表达",
    description: "在事实确认之后完成简历改写与面试准备，让每一句输出都有证据可依。",
    href: "/resume-rewrite",
    icon: PenLine
  }
];

const marqueeItems = ["真实经历", "岗位表达", "证据可溯", "经得起追问"];

function Diamond() {
  return <span className="mx-6 inline-block h-2 w-2 rotate-45 bg-[var(--brand)]" />;
}

export function LandingPage() {
  const primaryHref = hasClerkCredentials ? "/sign-up" : "/workspace";
  const secondaryHref = hasClerkCredentials ? "/sign-in" : "/resume-materials";
  const primaryLabel = hasClerkCredentials ? "注册并开始使用" : "进入工作台";
  const secondaryLabel = hasClerkCredentials ? "已有账号，去登录" : "从简历材料开始";

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-0 pt-10 sm:pt-14 lg:pt-20">
        {/* 背景层 */}
        <ParticleField className="opacity-70" count={64} />
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-70"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_62%)] blur-2xl dark:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-52 top-1/3 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(199,210,254,0.35),transparent_60%)] blur-2xl dark:hidden"
          aria-hidden
        />

        {/* 旋转徽标 */}
        <div
          className="pointer-events-none absolute right-6 top-6 hidden select-none xl:block"
          aria-hidden
        >
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg viewBox="0 0 144 144" className="spin-slow absolute inset-0 h-full w-full">
              <defs>
                <path
                  id="circlePath"
                  d="M 72,72 m -54,0 a 54,54 0 1,1 108,0 a 54,54 0 1,1 -108,0"
                />
              </defs>
              <text className="fill-[var(--ink-soft)] text-[11.5px] font-medium uppercase tracking-[0.28em]">
                <textPath href="#circlePath">
                  Signal · Evidence · Match · Trust ·
                </textPath>
              </text>
            </svg>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-[0_16px_40px_-14px_var(--glow)]">
              <Target className="h-6 w-6" strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-14 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,380px)] xl:items-start xl:gap-12">
            {/* 主标题区（立即渲染，不靠滚动显现） */}
            <div>
              <div className="eyebrow">AI 求职工作台 · Signal System</div>

              <h1 className="display-xl mt-7 text-[var(--ink)]">
                把真实经历，
                <br />
                讲成岗位
                <br />
                听得懂的
                <br />
                <span className="text-stroke">表达。</span>{" "}
                <span className="font-serif-accent text-[0.5em] align-middle text-[var(--ink-soft)]">
                  expression.
                </span>
              </h1>

              <p className="mt-8 max-w-xl text-base leading-8 text-[var(--ink-soft)] sm:text-lg">
                从材料录入到面试准备，AI 全程基于你的真实经历做复盘、匹配与改写。
                <span className="font-semibold text-[var(--ink-2)]">不编造、可溯源、经得起追问。</span>
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Magnetic strength={0.28}>
                  <Link href={primaryHref} className="btn-primary group !px-8 !py-4 !text-base">
                    {primaryLabel}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <Link href={secondaryHref} className="btn-secondary !px-8 !py-4 !text-base">
                    {secondaryLabel}
                  </Link>
                </Magnetic>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                <span className="flex items-center gap-2">
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  基于真实材料
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--line-strong)]" />
                  全流程可溯源
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--line-strong)]" />
                  按 JD 定制
                </span>
              </div>
            </div>

            {/* 信号控制台（立即渲染） */}
            <div className="hidden xl:block">
              <TiltCard className="rounded-[32px]">
                <div className="scanline rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="pulse-dot h-2 w-2 rounded-full bg-[var(--lime)]" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--ink-soft)]">
                        Signal Console
                      </span>
                    </div>
                    <span className="soft-chip">LIVE</span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      { icon: ShieldCheck, label: "事实可信", value: "0 编造" },
                      { icon: Target, label: "岗位贴合", value: "JD 逐条匹配" },
                      { icon: Link2, label: "可溯源", value: "句句有证据" }
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-deep)]/50 p-4 transition hover:border-[var(--brand-soft)] hover:bg-[var(--brand-soft)]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white">
                          <item.icon className="h-5 w-5" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
                            {item.label}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
                            {item.value}
                          </div>
                        </div>
                        <div className="flex h-8 items-end gap-[3px]">
                          {[0, 1, 2, 3].map((bar) => (
                            <span
                              key={bar}
                              className="eq-bar w-[3px] rounded-full bg-[var(--brand)]"
                              style={{ animationDelay: `${bar * 0.14}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-dashed border-[var(--line)] pt-4 text-[11px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
                    <span className="font-semibold text-[var(--brand)]">INPUT</span> 简历 + 项目材料 + JD
                    <span className="mx-2 inline-block h-2 w-2 rotate-45 bg-[var(--ink-faint)]" />
                    <span className="font-semibold text-[var(--brand)]">OUTPUT</span> 岗位化表达
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>

        {/* 跑马灯 */}
        <Reveal delay={480} className="mt-16 lg:mt-24">
          <div className="border-y border-[var(--line)] py-5">
            <Marquee duration={26}>
              {marqueeItems.map((item) => (
                <span
                  key={item}
                  className="flex items-center whitespace-nowrap text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl"
                >
                  {item}
                  <Diamond />
                </span>
              ))}
            </Marquee>
          </div>
        </Reveal>
      </section>

      {/* ============ 能力 Bento ============ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow">Core Capabilities</div>
              <h2 className="display-md mt-4 max-w-xl text-[var(--ink)]">
                不是生成器，
                <br />
                是<span className="text-gradient">信号放大器。</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-[var(--ink-soft)]">
              你的原始经历是素材，AI 负责把素材放大成岗位能接收的信号 ——
              中间隔着一道不越过的底线：不编造。
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Reveal className="md:col-span-2" delay={60}>
            <TiltCard className="group h-full rounded-[32px] border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl transition-colors hover:border-[var(--brand-soft)]">
              <div className="flex h-full flex-col justify-between p-7 sm:p-9">
                <div className="flex items-start justify-between">
                  <span className="icon-circle h-14 w-14">
                    <ShieldCheck className="h-6 w-6" strokeWidth={1.9} />
                  </span>
                  <span className="font-serif-accent text-2xl text-[var(--ink-faint)]">01</span>
                </div>
                <div className="mt-14">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--brand)]">
                    Fact First
                  </div>
                  <h3 className="display-sm mt-3 text-[var(--ink)]">事实可信</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-[var(--ink-soft)]">
                    AI 不编造经历。每一轮复盘都以你录入的真实材料为底，缺信息就追问，不补一段不存在的经历。
                  </p>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          <Reveal delay={140}>
            <TiltCard className="group h-full rounded-[32px] border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl transition-colors hover:border-[var(--brand-soft)]">
              <div className="flex h-full flex-col justify-between p-7 sm:p-9">
                <div className="flex items-start justify-between">
                  <span className="icon-circle h-14 w-14">
                    <Target className="h-6 w-6" strokeWidth={1.9} />
                  </span>
                  <span className="font-serif-accent text-2xl text-[var(--ink-faint)]">02</span>
                </div>
                <div className="mt-14">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--brand)]">
                    JD Driven
                  </div>
                  <h3 className="display-sm mt-3 text-[var(--ink)]">岗位贴合</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    按目标 JD 定制表达，逐条对齐能力要求，匹配点与差距点一目了然。
                  </p>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          <Reveal delay={120}>
            <TiltCard className="group h-full rounded-[32px] border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl transition-colors hover:border-[var(--brand-soft)]">
              <div className="flex h-full flex-col justify-between p-7 sm:p-9">
                <div className="flex items-start justify-between">
                  <span className="icon-circle h-14 w-14">
                    <Link2 className="h-6 w-6" strokeWidth={1.9} />
                  </span>
                  <span className="font-serif-accent text-2xl text-[var(--ink-faint)]">03</span>
                </div>
                <div className="mt-14">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--brand)]">
                    Traceable
                  </div>
                  <h3 className="display-sm mt-3 text-[var(--ink)]">可溯源</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    每句输出都挂回证据，面试官追问到哪里，答案就在哪里。
                  </p>
                </div>
              </div>
            </TiltCard>
          </Reveal>

          <Reveal className="md:col-span-2" delay={200}>
            <div className="flex h-full flex-col justify-between rounded-[32px] bg-[var(--brand)] p-7 text-white sm:p-9 dark:bg-[var(--brand)] dark:text-white">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]">
                  Manifesto
                </span>
                <ArrowUpRight className="h-5 w-5 opacity-70" />
              </div>
              <p className="font-serif-accent mt-16 max-w-2xl text-2xl leading-snug sm:text-[2rem]">
                “表达不是包装，是把做过的事，
                <br className="hidden sm:block" />
                讲成别人听得懂的语言。”
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ 工作流 ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <Reveal>
          <div className="eyebrow">Workflow</div>
          <h2 className="display-md mt-4 text-[var(--ink)]">
            四条线，走完求职表达闭环。
          </h2>
        </Reveal>

        <div className="mt-12 border-t border-[var(--line)]">
          {workflow.map((step, index) => (
            <Reveal key={step.index} delay={index * 70}>
              <Link
                href={step.href}
                className="group relative flex flex-col gap-4 border-b border-[var(--line)] py-8 transition-colors hover:bg-[var(--brand-soft)] sm:flex-row sm:items-center sm:gap-10 sm:px-4"
              >
                <span className="display-sm w-16 shrink-0 text-stroke !text-4xl !font-bold sm:!text-5xl">
                  {step.index}
                </span>
                <span className="hidden h-12 w-px shrink-0 bg-[var(--line-strong)] sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <step.icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.9} />
                    <h3 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
                    {step.description}
                  </p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-[var(--ink-soft)] transition-all duration-300 group-hover:rotate-45 group-hover:border-[var(--brand)] group-hover:bg-[var(--brand)] group-hover:text-white">
                  <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ 收尾 CTA ============ */}
      <section className="relative overflow-hidden border-t border-[var(--line)]">
        <div
          className="pointer-events-none absolute inset-0 bg-grid opacity-50"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[46rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--brand-soft),transparent_65%)] blur-2xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8 lg:py-32">
          <Reveal>
            <div className="flex justify-center">
              <div className="eyebrow">Get Started</div>
            </div>
            <h2 className="display-xl mt-6 text-[var(--ink)]">
              开始你的
              <span className="text-stroke">第一次复盘。</span>
            </h2>
            <p className="mx-auto mt-6 max-w-md text-base leading-8 text-[var(--ink-soft)]">
              从一段真实经历出发，生成一份经得起追问的岗位表达。
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Magnetic strength={0.3}>
                <Link href={primaryHref} className="btn-primary group !px-10 !py-4 !text-base">
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.2}>
                <Link href={secondaryHref} className="btn-secondary !px-10 !py-4 !text-base">
                  {secondaryLabel}
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>

        {/* 页脚 */}
        <footer className="relative border-t border-[var(--line)]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand)] text-xs font-bold text-white">
                J
              </span>
              <span className="text-sm font-semibold text-[var(--ink-2)]">JD Helper</span>
              <span className="text-sm text-[var(--ink-faint)]">· AI 面试复盘与 JD 定制求职助手</span>
            </div>
            <span className="font-serif-accent text-sm text-[var(--ink-faint)]">
              designed as an interactive canvas — no noise, only signal.
            </span>
          </div>
        </footer>
      </section>
    </>
  );
}
