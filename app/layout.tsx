import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/app-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { hasClerkCredentials } from "@/lib/clerk-env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI 面试复盘与 JD 定制求职助手",
    template: "%s | AI 面试复盘与 JD 定制求职助手"
  },
  description: "面向求职场景的 AI 复盘与表达转化工作台。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const app = <AppShell clerkEnabled={hasClerkCredentials}>{children}</AppShell>;

  return (
    <html lang="zh-CN">
      <body>
        {hasClerkCredentials ? <ClerkProvider appearance={clerkAppearance}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
