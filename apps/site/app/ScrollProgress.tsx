"use client";

import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;
      const root = document.documentElement;
      const scrollableHeight = root.scrollHeight - root.clientHeight;
      const progress = scrollableHeight > 0
        ? Math.min(1, Math.max(0, root.scrollTop / scrollableHeight))
        : 0;
      progressRef.current?.style.setProperty("--scroll-progress", String(progress));
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateProgress);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return <div ref={progressRef} className="scroll-progress" aria-hidden="true" />;
}
