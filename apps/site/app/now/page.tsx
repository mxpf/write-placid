import type { Metadata } from "next";
import { ArticleBody } from "../ArticleBody";
import { Footer } from "../Footer";
import { LetterCascade } from "../LetterCascade";
import { stripInlineMarkdown } from "../inline-markdown";
import { currentNow } from "../posts";
import { siteConfig } from "../site-config";
import { sitePath } from "../site-path";

export const metadata: Metadata = {
  title: "Now",
  description: currentNow
    ? stripInlineMarkdown(currentNow.paragraphs[0])
    : "What is holding my attention now.",
  alternates: {
    canonical: "/now",
    types: { "application/rss+xml": "/rss.xml" },
  },
};

export default function NowPage() {
  return (
    <main className="site article-page">
      <div className="article-frame">
        <a className="desktop-brand" href={sitePath("/")}><LetterCascade text={siteConfig.name} /></a>
        <article
          className="article-column"
          data-content-slug={currentNow?.slug || ""}
          data-content-title="Now"
        >
          <header className="article-header">
            <h1>Now</h1>
            {currentNow ? <p>{currentNow.date}</p> : null}
            {currentNow ? (
              <p className="author-edit-action" hidden>
                <a href={siteConfig.studioUrl || sitePath("/")}>Edit</a>
              </p>
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
