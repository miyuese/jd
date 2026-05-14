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
      badge="Quest 3.1"
      title="创建你的求职工作台账号"
      description="注册完成后会直接进入工作台，从录入材料开始搭建你的 AI 复盘与表达资产。"
    >
      {hasClerkCredentials ? (
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/workspace" />
      ) : (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 text-sm leading-7 text-slate-700">
          尚未配置 Clerk 环境变量，注册页结构已接入，但真实注册功能还需要在 `.env.local` 中补齐
          `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 和 `CLERK_SECRET_KEY`。
        </div>
      )}
    </AuthPageShell>
  );
}
