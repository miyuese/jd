"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** 延迟（ms），用于交错入场 */
  delay?: number;
  as?: "div" | "section" | "span" | "li";
  style?: CSSProperties;
};

/**
 * 滚动显现：淡入 + 上浮。
 * 元素进入视口 12% 时触发；并设 900ms 兜底定时器，
 * 保证 IntersectionObserver 在某些渲染管线未派发时也能显现。
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div", style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("reveal-in");
      return;
    }

    const reveal = () => node.classList.add("reveal-in");

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal();
              observer.unobserve(node);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      observer.observe(node);
      const fallback = window.setTimeout(() => {
        if (!node.classList.contains("reveal-in")) reveal();
        observer.disconnect();
      }, 900 + (delay || 0));

      return () => {
        window.clearTimeout(fallback);
        observer.disconnect();
      };
    }

    reveal();
  }, [delay]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }}
    >
      {children}
    </Tag>
  );
}