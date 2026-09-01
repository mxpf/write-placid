import type { Metadata } from "next";
import { RSS_PATH, SITE_NAME } from "../site-config.mjs";
import { Footer } from "./Footer";
import { posts } from "./posts";
import { SiteBrand } from "./SiteBrand";
import { sitePath } from "./site-path";

const staticExport = process.env.STATIC_EXPORT === "1";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": RSS_PATH },
  },
};

export default function Home() {
  return (
    <main className="site index-page">
      <div className="index-frame">
        <SiteBrand />
        <div className="index-column">
          <h1 className="sr-only">{SITE_NAME}</h1>
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
