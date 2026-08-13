"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { AuthControls } from "@/components/auth-controls";
import { CursorGlow } from "@/components/fx/cursor-glow";
import { SideNav } from "@/components/side-nav";

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
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] dark:bg-[var(--surface)]"
    >
      <Sun
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
        strokeWidth={1.8}
      />
      <Moon
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        }`}
        strokeWidth={1.8}
      />
    </button>
  );
}

export function AppShell({ children, clerkEnabled }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors duration-300">
      <CursorGlow />

      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 -rotate-6 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))] text-sm font-bold text-white shadow-[0_10px_26px_-10px_var(--glow)] transition-transform duration-300 group-hover:rotate-0">
              J
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-[var(--ink)]">JD Helper</span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.26em] text-[var(--ink-faint)]">
                Signal System
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <AuthControls clerkEnabled={clerkEnabled} />
          </div>
        </div>
      </header>

      <div
        className={[
          "mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10",
          isAuthPage ? "lg:grid-cols-1" : "lg:grid-cols-[248px_minmax(0,1fr)]"
        ].join(" ")}
      >
        {!isAuthPage ? (
          <aside className="min-w-0">
            <div className="sticky top-[5.5rem] rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-3 backdrop-blur-xl">
              <SideNav />
            </div>
          </aside>
        ) : null}
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
