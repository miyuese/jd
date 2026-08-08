"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

type AuthControlsProps = {
  clerkEnabled: boolean;
};

export function AuthControls({ clerkEnabled }: AuthControlsProps) {
  if (!clerkEnabled) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50/90 px-4 py-3 text-left shadow-sm xl:min-w-[280px]">
        <div className="text-xs text-teal-700">开发模式</div>
        <div className="mt-1 text-sm font-medium text-slate-900">无需登录，功能已全部可用</div>
        <p className="mt-1 text-xs leading-6 text-slate-600">
          当前以开发用户身份运行，记忆库、简历改写、面试准备等都能正常使用。只有正式部署上线时才需要配置 Clerk 登录。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-white/85 px-4 py-3 text-left shadow-sm xl:min-w-[280px]">
      <SignedOut>
        <div className="text-xs text-slate-500">当前状态</div>
        <div className="mt-1 text-sm font-medium text-slate-900">未登录</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            去登录
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300"
          >
            去注册
          </Link>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">当前状态</div>
            <div className="mt-1 text-sm font-medium text-slate-900">已登录</div>
            <p className="mt-1 text-xs leading-6 text-slate-600">右侧用户菜单支持查看身份信息与退出登录。</p>
          </div>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: "h-10 w-10"
              }
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
}
