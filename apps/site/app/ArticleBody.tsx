import type { ContentListBlock } from "@mxpf/write-placid-core/markdown";
import { parseContentBlocks, stripInlineMarkdown } from "../lib/markdown.mjs";
import { InlineText } from "./InlineText";
import { ScrollFadeImage } from "./ScrollFadeImage";

function paragraphClassName(paragraph: string) {
  return /^[“‘"']/.test(stripInlineMarkdown(paragraph).trimStart())
    ? "optical-margin-fallback"
    : undefined;
}

function ArticleList({ block }: { block: ContentListBlock }) {
  const items = block.items.map((item, itemIndex) => (
    <li key={`${block.index}-${itemIndex}-${item.text}`}>
      <InlineText text={item.text} />
      {item.children?.map((child, childIndex) => (
        <ArticleList block={child} key={`${child.index}-${childIndex}-${child.type}`} />
      ))}
    </li>
  ));

  return block.type === "ordered-list" ? (
    <ol className="article-list article-numbered-list" start={block.start}>{items}</ol>
  ) : (
    <ul className="article-list">{items}</ul>
  );
}

export function ArticleBody({ paragraphs }: { paragraphs: readonly string[] }) {
  return parseContentBlocks(paragraphs).map((block) => {
    if (block.type === "heading") {
      return <h2 key={`${block.index}-${block.text}`}><InlineText text={block.text} /></h2>;
    }

    if (block.type === "blockquote") {
      return (
        <blockquote key={`${block.index}-${block.text}`}>
          <p className={paragraphClassName(block.text)}><InlineText text={block.text} /></p>
        </blockquote>
      );
    }

    if (block.type === "unordered-list" || block.type === "ordered-list") {
      return <ArticleList block={block} key={`list-${block.index}`} />;
    }

    if (block.type === "image") {
      return <ScrollFadeImage key={`${block.index}-${block.src}`} {...block} />;
    }

    return (
      <p className={paragraphClassName(block.text)} key={`${block.index}-${block.text}`}>
        <InlineText text={block.text} />
      </p>
    );
  });
}
