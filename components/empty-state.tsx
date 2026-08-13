import Link from "next/link";
import { Inbox } from "lucide-react";
import { type ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

const defaultIcon = <Inbox className="h-7 w-7 text-[var(--brand)]" strokeWidth={1.6} />;

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-primary-200 bg-primary-50/40 px-8 py-12 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-primary-100">
        {icon ?? defaultIcon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-slate-600">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? (
            <Link href={action.href} className="btn-primary">
              {action.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link href={secondaryAction.href} className="btn-secondary">
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
