import { parseContentBlocks, stripInlineMarkdown } from "../lib/markdown.mjs";
import { InlineText } from "./InlineText";

function paragraphClassName(paragraph: string) {
  return /^[“‘"']/.test(stripInlineMarkdown(paragraph).trimStart())
    ? "optical-margin-fallback"
    : undefined;
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
      const items = block.items.map((item, itemIndex) => (
        <li key={`${block.index + itemIndex}-${item}`}><InlineText text={item} /></li>
      ));

      return block.type === "ordered-list" ? (
        <ol className="article-list article-numbered-list" key={`list-${block.index}`} start={block.start}>
          {items}
        </ol>
      ) : (
        <ul className="article-list" key={`list-${block.index}`}>{items}</ul>
      );
    }

    return (
      <p className={paragraphClassName(block.text)} key={`${block.index}-${block.text}`}>
        <InlineText text={block.text} />
      </p>
    );
  });
}
