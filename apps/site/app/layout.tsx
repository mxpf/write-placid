import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "./site-config";
import { sitePath } from "./site-path";
import { TypographyGuards } from "./TypographyGuards";
import { ThemeToggle } from "./ThemeToggle";

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
    icon: [{ url: sitePath("/favicon.svg"), type: "image/svg+xml" }],
    shortcut: sitePath("/favicon.svg"),
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="write-placid-theme-init"
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem("write-placid-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}}catch{}`,
          }}
        />
        {siteConfig.relMeUrl ? <link rel="me" href={siteConfig.relMeUrl} /> : null}
        {siteConfig.webmentionEndpoint ? (
          <link rel="webmention" href={siteConfig.webmentionEndpoint} />
        ) : null}
      </head>
      <body data-studio-url={siteConfig.studioUrl || undefined}>
        <ThemeToggle />
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
        <script defer src={sitePath("/theme-toggle.js")} />
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
