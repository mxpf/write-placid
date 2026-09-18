import Link from "next/link";
import { parseInlineMarkdown } from "../lib/markdown.mjs";
import { guardTypographyString } from "../lib/typography.mjs";

const staticExport = process.env.STATIC_EXPORT === "1";

function staticHref(href: string) {
  if (href === "/" || /\.[a-z0-9]+(?:[?#]|$)/i.test(href)) return href;
  const match = href.match(/^([^?#]+)(.*)$/);
  return match ? `${match[1]}.html${match[2]}` : href;
}

export function InlineText({ text }: { text: string }) {
  return parseInlineMarkdown(text).map((token, index) => {
    if (token.type === "italic") {
      return <em key={index}><InlineText text={token.value} /></em>;
    }
    if (token.type === "link") {
      if (token.href.startsWith("/")) {
        if (staticExport) {
          return (
            <a key={index} href={staticHref(token.href)}>
              <InlineText text={token.value} />
            </a>
          );
        }
        return (
          <Link key={index} href={token.href}>
            <InlineText text={token.value} />
          </Link>
        );
      }
      return (
        <a key={index} href={token.href} rel="noreferrer">
          <InlineText text={token.value} />
        </a>
      );
    }
    return guardTypographyString(token.value);
  });
}
