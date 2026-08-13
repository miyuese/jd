"use client";

import { useEffect, useRef } from "react";

/**
 * 全局光标辉光：跟随指针的径向渐变光斑（lerp 平滑）。
 * 仅精确指针设备生效，触屏自动隐藏（CSS 控制）。
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let visible = false;

    const onMove = (event: MouseEvent) => {
      tx = event.clientX;
      ty = event.clientY;
      if (!visible) {
        visible = true;
        node.style.opacity = "0.4";
      }
    };

    const onLeave = () => {
      visible = false;
      node.style.opacity = "0";
    };

    const loop = () => {
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="cursor-glow" aria-hidden />;
}
