import type { ReactNode } from "react";
import { InlineText } from "./InlineText";
import { stripInlineMarkdown } from "./inline-markdown";

function paragraphClassName(paragraph: string) {
  return /^[“‘"']/.test(stripInlineMarkdown(paragraph).trimStart())
    ? "optical-margin-fallback"
    : undefined;
}

export function ArticleBody({ paragraphs }: { paragraphs: readonly string[] }) {
  const blocks: ReactNode[] = [];

  for (let index = 0; index < paragraphs.length;) {
    const paragraph = paragraphs[index];
    if (/^##\s+/.test(paragraph)) {
      const heading = paragraph.replace(/^##\s+/, "");
      blocks.push(<h2 key={`${index}-${heading}`}><InlineText text={heading} /></h2>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(paragraph)) {
      const quote = paragraph.replace(/^>\s?/gm, "");
      blocks.push(
        <blockquote key={`${index}-${quote}`}>
          <p className={paragraphClassName(quote)}><InlineText text={quote} /></p>
        </blockquote>,
      );
      index += 1;
      continue;
    }

    if (/^\s*-\s+/.test(paragraph)) {
      const listStart = index;
      const items: ReactNode[] = [];
      while (index < paragraphs.length && /^\s*-\s+/.test(paragraphs[index])) {
        const item = paragraphs[index].replace(/^\s*-\s+/, "");
        items.push(<li key={`${index}-${item}`}><InlineText text={item} /></li>);
        index += 1;
      }
      blocks.push(<ul className="article-list" key={`list-${listStart}`}>{items}</ul>);
      continue;
    }

    blocks.push(
      <p className={paragraphClassName(paragraph)} key={`${index}-${paragraph}`}>
        <InlineText text={paragraph} />
      </p>,
    );
    index += 1;
  }

  return blocks;
}
