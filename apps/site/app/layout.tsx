import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "./site-config";
import { TypographyGuards } from "./TypographyGuards";

const author = siteConfig.authorName && siteConfig.authorUrl
  ? { name: siteConfig.authorName, url: siteConfig.authorUrl }
  : undefined;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    ...(author ? [{
      "@type": "Person",
      "@id": `${siteConfig.url}/#author`,
      name: author.name,
      url: author.url,
      ...(siteConfig.relMeUrl ? { sameAs: [siteConfig.relMeUrl] } : {}),
    }] : []),
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: `${siteConfig.url}/`,
      name: siteConfig.name,
      description: siteConfig.description,
      ...(author ? { author: { "@id": `${siteConfig.url}/#author` } } : {}),
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `${siteConfig.name} - %s`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  ...(author ? {
    authors: [author],
    creator: author.name,
    publisher: author.name,
  } : {}),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  alternates: {
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
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
        {siteConfig.relMeUrl ? <link rel="me" href={siteConfig.relMeUrl} /> : null}
        {siteConfig.webmentionEndpoint ? (
          <link rel="webmention" href={siteConfig.webmentionEndpoint} />
        ) : null}
      </head>
      <body data-studio-url={siteConfig.studioUrl || undefined}>
        {children}
        <TypographyGuards />
        <script
          id="write-placid-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <script defer src="/author-mode.js" />
        {siteConfig.trackingScriptUrl && siteConfig.trackingEndpoint && siteConfig.trackingSiteKey ? (
          <script
            defer
            src={siteConfig.trackingScriptUrl}
            data-site={siteConfig.trackingSiteKey}
            data-endpoint={siteConfig.trackingEndpoint}
          />
        ) : null}
      </body>
    </html>
  );
}
