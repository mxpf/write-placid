import type { Metadata } from "next";
import { stripInlineMarkdown } from "../../lib/markdown.mjs";
import { RSS_PATH } from "../../site-config.mjs";
import { ArticleBody } from "../ArticleBody";
import { AuthorEditAction } from "../AuthorEditAction";
import { Footer } from "../Footer";
import { SiteBrand } from "../SiteBrand";
import { currentNow } from "../posts";

export const metadata: Metadata = {
  title: "Now",
  description: currentNow
    ? stripInlineMarkdown(currentNow.paragraphs[0])
    : "What is holding my attention now.",
  alternates: {
    canonical: "/now",
    types: { "application/rss+xml": RSS_PATH },
  },
};

export default function NowPage() {
  return (
    <main className="site article-page">
      <div className="article-frame">
        <SiteBrand />
        <article
          className="article-column"
          data-content-slug={currentNow?.slug || ""}
          data-content-title="Now"
        >
          <header className="article-header">
            <h1>Now</h1>
            {currentNow ? <p>{currentNow.date}</p> : null}
            {currentNow ? (
              <AuthorEditAction />
            ) : null}
          </header>
          <div className="article-body">
            {currentNow ? (
              <>
                <ArticleBody paragraphs={currentNow.paragraphs} />
                <p>
                  This page is inspired by <a href="https://sive.rs/nowff">Derek Sivers&apos; /now idea</a>: a simple page for what you&apos;re actually paying attention to right now.
                </p>
              </>
            ) : <p>Nothing here yet.</p>}
          </div>
          <Footer showBrand revealAtEnd />
        </article>
      </div>
    </main>
  );
}
