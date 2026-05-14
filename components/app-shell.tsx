"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { SideNav } from "@/components/side-nav";
import { hasClerkCredentials } from "@/lib/clerk-env";

type AppShellProps = {
  children: ReactNode;
  clerkEnabled: boolean;
};

export function AppShell({ children, clerkEnabled }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold text-slate-900">
            JD 助手
          </Link>

          <AuthControls clerkEnabled={clerkEnabled} />
        </div>
      </header>

      <div
        className={[
          "mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8",
          isAuthPage ? "lg:grid-cols-1" : "lg:grid-cols-[220px_minmax(0,1fr)]"
        ].join(" ")}
      >
        {!isAuthPage ? (
          <aside className="min-w-0">
            <SideNav />
          </aside>
        ) : null}
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
