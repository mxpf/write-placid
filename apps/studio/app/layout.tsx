import type { Metadata, Viewport } from "next";
import "./globals.css";
import { studioConfig } from "./studio-config";

export const metadata: Metadata = {
  title: `${studioConfig.publicationName} Studio`,
  description: `A private place to write and publish ${studioConfig.publicationName}.`,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: studioConfig.publicationName,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#171816" },
  ],
  colorScheme: "light dark",
};

const themeScript = `(() => {
  try {
    const saved = localStorage.getItem("write-placid-studio-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
