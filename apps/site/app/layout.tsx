import type { Metadata } from "next";
import {
  AUTHOR,
  REL_ME_URL,
  RSS_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  STUDIO_URL,
  TRACKING,
  WEBMENTION_ENDPOINT,
} from "../site-config.mjs";
import "./globals.css";
import { sitePath } from "./site-path";
import { TypographyGuards } from "./TypographyGuards";

const authorId = `${SITE_URL}/#author`;
const websiteId = `${SITE_URL}/#website`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    ...(AUTHOR ? [{
      "@type": "Person",
      "@id": authorId,
      name: AUTHOR.name,
      url: AUTHOR.url,
      ...(AUTHOR.relMeUrl ? { sameAs: [AUTHOR.relMeUrl] } : {}),
    }] : []),
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      ...(AUTHOR ? { author: { "@id": authorId } } : {}),
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `${SITE_NAME} - %s`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  ...(AUTHOR ? {
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    creator: AUTHOR.name,
    publisher: AUTHOR.name,
  } : {}),
  icons: {
    icon: [{ url: sitePath("/favicon.svg"), type: "image/svg+xml" }],
    shortcut: sitePath("/favicon.svg"),
  },
  alternates: {
    types: {
      "application/rss+xml": RSS_PATH,
    },
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {REL_ME_URL ? <link rel="me" href={REL_ME_URL} /> : null}
        {WEBMENTION_ENDPOINT ? (
          <link rel="webmention" href={WEBMENTION_ENDPOINT} />
        ) : null}
      </head>
      <body data-studio-url={STUDIO_URL || undefined}>
        {children}
        <TypographyGuards />
        <script
          id="write-placid-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <script defer src={sitePath("/author-mode.js")} />
        {TRACKING.trackerUrl && TRACKING.collectUrl && TRACKING.siteKey ? (
          <script
            defer
            src={TRACKING.trackerUrl}
            data-site={TRACKING.siteKey}
            data-endpoint={TRACKING.collectUrl}
          />
        ) : null}
      </body>
    </html>
  );
}
