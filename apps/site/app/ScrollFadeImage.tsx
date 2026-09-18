"use client";

import { useEffect, useRef } from "react";
import { CaptionText } from "./CaptionText";

const fullyVisibleRatio = 2 / 3;
const thresholds = Array.from({ length: 101 }, (_, index) => index / 100);

export function ScrollFadeImage({ alt, src, title }: {
  alt: string;
  src: string;
  title?: string;
}) {
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;

    const observer = new IntersectionObserver(([entry]) => {
      const progress = Math.min(entry.intersectionRatio / fullyVisibleRatio, 1);
      figure.style.setProperty("--article-image-opacity", String(0.6 + (0.4 * progress)));
    }, { threshold: thresholds });

    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="article-image" ref={figureRef}>
      {/* Article images are authored dynamically in Markdown, so their dimensions are not known at build time. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {title ? <figcaption><CaptionText text={title} /></figcaption> : null}
    </figure>
  );
}
