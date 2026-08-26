import type { Metadata } from "next";
import { Footer } from "./Footer";
import { LetterCascade } from "./LetterCascade";
import { posts } from "./posts";
import { siteConfig } from "./site-config";
import { sitePath } from "./site-path";

const staticExport = process.env.STATIC_EXPORT === "1";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/rss.xml" },
  },
};

export default function Home() {
  return (
    <main className="site index-page">
      <div className="index-frame">
        <a className="desktop-brand" href={sitePath("/")}><LetterCascade text={siteConfig.name} /></a>
        <div className="index-column">
          <h1 className="sr-only">{siteConfig.name}</h1>
          <ol className="post-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <a href={sitePath(`/${post.slug}${staticExport ? ".html" : ""}`)}>{post.title}</a>
              </li>
            ))}
          </ol>
          <Footer showBrand />
        </div>
      </div>
    </main>
  );
}
