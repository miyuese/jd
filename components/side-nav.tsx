"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups } from "@/lib/navigation";

export function SideNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="space-y-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--ink-faint)]">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.description}
                  className={[
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-[linear-gradient(120deg,var(--brand),var(--brand-strong))] text-white shadow-[0_14px_30px_-14px_var(--glow)]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--brand-soft)] hover:text-[var(--ink)]"
                  ].join(" ")}
                >
                  {active ? (
                    <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" />
                  ) : null}
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition-all duration-200",
                      active
                        ? "bg-white/15 text-white"
                        : "bg-[var(--brand-soft)] text-[var(--brand)] group-hover:scale-105"
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span className="truncate">{item.label}</span>
                  {active ? (
                    <span className="ml-auto h-1.5 w-1.5 rotate-45 bg-[var(--lime)] opacity-80" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
