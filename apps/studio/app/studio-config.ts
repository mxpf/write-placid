export const studioConfig = {
  publicationName: process.env.NEXT_PUBLIC_PUBLICATION_NAME || "Write Placid",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  themeStorageKey: process.env.NEXT_PUBLIC_THEME_STORAGE_KEY || "write-placid-studio-theme",
};

export function liveCheckUrl(siteUrl: string, path: string, updatedAt: string) {
  const url = new URL(siteUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  url.search = "";
  url.hash = "";
  url.searchParams.set("studio-check", updatedAt);
  return url;
}
