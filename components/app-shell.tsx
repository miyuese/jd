"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/auth-controls";
import { SideNav } from "@/components/side-nav";
import { hasClerkCredentials } from "@/lib/clerk-env";

type AppShellProps = {
  children: ReactNode;
  clerkEnabled: boolean;
};

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("jd-helper:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved ? saved === "dark" : prefersDark;
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("jd-helper:theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-base text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

export function AppShell({ children, clerkEnabled }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(83,74,183,0.9)]">
              J
            </span>
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">JD 助手</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthControls clerkEnabled={clerkEnabled} />
          </div>
        </div>
      </header>

      <div
        className={[
          "mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8",
          isAuthPage ? "lg:grid-cols-1" : "lg:grid-cols-[240px_minmax(0,1fr)]"
        ].join(" ")}
      >
        {!isAuthPage ? (
          <aside className="min-w-0">
            <div className="sticky top-20 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
              <SideNav />
            </div>
          </aside>
        ) : null}
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
