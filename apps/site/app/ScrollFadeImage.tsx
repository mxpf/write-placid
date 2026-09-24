"use client";

import { useEffect, useRef } from "react";
import { attachScrollFade } from "@mxpf/write-placid-core/scroll-fade";
import { CaptionText } from "./CaptionText";

export function ScrollFadeImage({ alt, src, title }: {
  alt: string;
  src: string;
  title?: string;
}) {
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;

    return attachScrollFade(figure);
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
