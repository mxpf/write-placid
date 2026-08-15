import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "./site-config";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `${siteConfig.name} - %s`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
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
      <body data-studio-url={siteConfig.studioUrl || undefined}>
        {children}
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
