import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth-page-shell";
import { hasClerkCredentials } from "@/lib/clerk-env";

export const metadata: Metadata = {
  title: "注册"
};

export default function SignUpPage() {
  return (
    <AuthPageShell
      badge="账号"
      title="创建你的求职工作台账号"
      description="注册完成后会直接进入工作台，从录入材料开始搭建你的 AI 复盘与表达资产。"
    >
      {hasClerkCredentials ? (
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/workspace" />
      ) : (
        <div className="rounded-[24px] border border-teal-200 bg-teal-50/90 p-5 text-sm leading-7 text-slate-700">
          <div className="text-xs text-teal-700">开发模式</div>
          <div className="mt-1 text-base font-medium text-slate-900">当前无需注册即可使用</div>
          <p className="mt-2">
            项目运行在开发模式，系统已自动以开发用户身份进入。你可以直接返回工作台，使用记忆库、项目卡片、JD
            分析、简历改写和面试准备等全部功能。
          </p>
          <p className="mt-2 text-slate-500">
            只有正式部署上线时，才需要在 <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">.env.local</code>{" "}
            中配置 <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
            和 <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">CLERK_SECRET_KEY</code>，用于真实注册与登录。
          </p>
        </div>
      )}
    </AuthPageShell>
  );
}
