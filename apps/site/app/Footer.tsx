/* eslint-disable @next/next/no-html-link-for-pages */

import { siteConfig } from "./site-config";

export function Footer({ showBrand = false }: { showBrand?: boolean }) {
  return (
    <footer className="footer">
      {showBrand ? <a className="footer-brand" href="/">{siteConfig.name}</a> : null}
      <nav className="footer-links" aria-label="Site">
        <a href="/about">About</a>
        <a href="/links">Links</a>
        <a href="/now">Now</a>
        {siteConfig.statsUrl ? <a href={siteConfig.statsUrl}>Stats</a> : null}
        <a href="/rss.xml" type="application/rss+xml">RSS</a>
      </nav>
    </footer>
  );
}
