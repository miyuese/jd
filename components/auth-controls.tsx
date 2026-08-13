"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, CircleHelp, FlaskConical } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

type AuthControlsProps = {
  clerkEnabled: boolean;
};

/**
 * 头部紧凑版登录态：开发模式 / 未登录 / 已登录 三种状态。
 */
export function AuthControls({ clerkEnabled }: AuthControlsProps) {
  if (!clerkEnabled) {
    return (
      <Link
        href="/settings"
        className="group flex h-10 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] dark:bg-[var(--surface)]"
      >
        <FlaskConical className="h-4 w-4 text-[var(--brand)]" strokeWidth={1.9} />
        <span className="hidden sm:inline">开发模式</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <div className="flex items-center">
      <SignedOut>
        <div className="flex items-center gap-1.5">
          <Link
            href="/sign-in"
            className="flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-[var(--ink-2)] transition hover:text-[var(--brand)]"
          >
            <CircleHelp className="h-4 w-4" strokeWidth={1.9} />
            登录
          </Link>
          <Link
            href="/sign-up"
            className="btn-primary flex h-10 items-center !px-5 !text-xs"
          >
            注册
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-4 pr-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]">
            <CircleCheck className="h-4 w-4 text-[var(--brand)]" strokeWidth={1.9} />
            <span className="hidden sm:inline">已登录</span>
          </span>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7"
              }
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
}
