"use client";

import type { ReactNode } from "react";

type MarqueeProps = {
  children: ReactNode;
  className?: string;
  /** 速度秒数，越大越慢 */
  duration?: number;
  reverse?: boolean;
};

/**
 * 跑马灯：内容横向无限滚动，hover 暂停。
 * 需要传入两组相同内容，首尾无缝衔接。
 */
export function Marquee({ children, className = "", duration = 30, reverse = false }: MarqueeProps) {
  return (
    <div className={`marquee ${className}`}>
      <div
        className="marquee-track"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal"
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
