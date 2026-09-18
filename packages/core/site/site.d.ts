import type { ContentDocument } from "./content.mjs";
export function generateRssFeed(posts: ContentDocument[], nowEntries: ContentDocument[], options: { siteName: string; siteUrl: string; description: string; rssPath?: string; language?: string; feedId?: string }): string;
export function generateSitemap(posts: ContentDocument[], pages: ContentDocument[], options: { siteUrl: string; nowPath?: string }): string;
export function redirectDocument(target: string, options?: { siteName?: string }): string;
