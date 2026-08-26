const basePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH || "";

export function sitePath(pathname: string) {
  if (!pathname.startsWith("/")) return pathname;
  return `${basePath}${pathname}`;
}
