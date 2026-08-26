/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { ArticleBody } from "../ArticleBody";
import { Footer } from "../Footer";
import { LetterCascade } from "../LetterCascade";
import { Webmentions } from "../Webmentions";
import { stripInlineMarkdown } from "../inline-markdown";
import { getPost, getStandalonePage, posts, standalonePages } from "../posts";
import { siteConfig } from "../site-config";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [...posts, ...standalonePages].map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  const standalonePage = getStandalonePage(slug);
  const content = post || standalonePage;
  return {
    title: content?.title,
    description: content ? stripInlineMarkdown(content.paragraphs[0]) : undefined,
    alternates: content ? {
      canonical: `/${slug}`,
      types: { "application/rss+xml": "/rss.xml" },
    } : undefined,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  const standalonePage = getStandalonePage(slug);
  const content = post || standalonePage;

  if (!content) {
    return (
      <main className="site article-page">
        <div className="article-frame">
          <a className="desktop-brand" href="/"><LetterCascade text={siteConfig.name} /></a>
          <article className="article-column">
            <h1>Nothing here yet.</h1>
            <p><a href="/">Back to the notes.</a></p>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="site article-page">
      <div className="article-frame">
        <a className="desktop-brand" href="/"><LetterCascade text={siteConfig.name} /></a>
        <article className="article-column" data-content-slug={slug} data-content-title={content.title}>
          <header className="article-header">
            <h1>{content.title}</h1>
            {post ? <p>{post.date}</p> : null}
            {post ? <p>{post.readingTime}</p> : null}
            <p className="author-edit-action" hidden>
              <a href={siteConfig.studioUrl || "/"}>Edit</a>
            </p>
          </header>
          <div className="article-body">
            <ArticleBody paragraphs={content.paragraphs} />
            {post?.source ? (
              <p className="article-source"><a href={post.source.href}>{post.source.label}</a></p>
            ) : null}
            {post?.updatedAt ? (
              <p className="article-last-edited"><em>Last edited {post.updatedAt}</em></p>
            ) : null}
          </div>
          {post ? <Webmentions slug={slug} /> : null}
          <Footer showBrand revealAtEnd />
        </article>
      </div>
    </main>
  );
}
