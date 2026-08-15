import Link from "next/link";
import { parseInlineMarkdown } from "./inline-markdown";

const staticExport = process.env.STATIC_EXPORT === "1";

export function InlineText({ text }: { text: string }) {
  return parseInlineMarkdown(text).map((token, index) => {
    if (token.type === "italic") {
      return <em key={index}><InlineText text={token.value} /></em>;
    }
    if (token.type === "link") {
      if (token.href.startsWith("/")) {
        if (staticExport) {
          return (
            <a key={index} href={token.href}>
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
    return token.value;
  });
}
