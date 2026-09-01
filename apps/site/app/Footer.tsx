"use client";

import { useEffect, useState } from "react";

import { AUTHOR, RSS_PATH, SITE_NAME, TRACKING } from "../site-config.mjs";
import { sitePath } from "./site-path";

export function Footer({
  showBrand = false,
  revealAtEnd = false,
}: {
  showBrand?: boolean;
  revealAtEnd?: boolean;
}) {
  const [revealIsArmed, setRevealIsArmed] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!revealAtEnd) return;

    const revealAtScrollEnd = () => {
      const distanceToEnd = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (distanceToEnd <= 1) setIsRevealed(true);
    };

    const animationFrame = window.requestAnimationFrame(() => {
      setRevealIsArmed(true);
      revealAtScrollEnd();
    });
    window.addEventListener("scroll", revealAtScrollEnd, { passive: true });
    window.addEventListener("resize", revealAtScrollEnd);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", revealAtScrollEnd);
      window.removeEventListener("resize", revealAtScrollEnd);
    };
  }, [revealAtEnd]);

  const className = [
    "footer",
    revealAtEnd && "footer--end-reveal",
    revealIsArmed && "is-armed",
    isRevealed && "is-revealed",
  ].filter(Boolean).join(" ");

  return (
    <footer className={className}>
      {showBrand ? <a className="footer-brand" href={sitePath("/")}>{SITE_NAME}</a> : null}
      <nav className="footer-links" aria-label="Site">
        <span className="footer-link-group">
          {AUTHOR?.url ? <a href={AUTHOR.url} rel="me">Work</a> : null}
          <a href={sitePath("/about")}>About</a>
          <a href={sitePath("/links")}>Links</a>
          <a href={sitePath("/now")}>Now</a>
        </span>
        <span className="footer-link-group">
          {TRACKING.dashboardUrl ? <a href={TRACKING.dashboardUrl}>Stats</a> : null}
          <a href={sitePath(RSS_PATH)} type="application/rss+xml">RSS</a>
        </span>
      </nav>
    </footer>
  );
}
