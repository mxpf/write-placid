import type { ContentDocument } from "./content.mjs";
export function generateRssFeed(posts: ContentDocument[], nowEntries: ContentDocument[], options: { siteName: string; siteUrl: string; description: string; rssPath?: string; language?: string; feedId?: string }): string;
export function generateSitemap(posts: ContentDocument[], pages: ContentDocument[], options: { siteUrl: string; nowPath?: string }): string;
export function redirectDocument(target: string, options?: { siteName?: string }): string;
export function firstSafeArticleImage(paragraphs: readonly string[]): { alt: string; src: string; title?: string } | null;
export function buildSocialMetadata(document: Pick<ContentDocument, "title" | "slug" | "paragraphs">, options: { siteName: string; siteUrl: string; fallbackImage: string; pathname?: string }): {
  openGraph: { title: string; description: string; siteName: string; url: string; images: { url: string; alt: string }[] };
  twitter: { card: "summary_large_image"; title: string; description: string; images: { url: string; alt: string }[] };
};
