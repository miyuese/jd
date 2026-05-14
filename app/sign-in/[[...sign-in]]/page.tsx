import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth-page-shell";
import { hasClerkCredentials } from "@/lib/clerk-env";

export const metadata: Metadata = {
  title: "登录"
};

export default function SignInPage() {
  return (
    <AuthPageShell
      badge="Quest 3.1"
      title="登录到你的求职工作台"
      description="登录后即可进入工作台、简历材料、项目材料、JD 分析和历史版本等核心入口。"
    >
      {hasClerkCredentials ? (
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/workspace" />
      ) : (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 text-sm leading-7 text-slate-700">
          尚未配置 Clerk 环境变量，登录页结构已接入，但真实登录功能还需要在 `.env.local` 中补齐
          `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 和 `CLERK_SECRET_KEY`。
        </div>
      )}
    </AuthPageShell>
  );
}
