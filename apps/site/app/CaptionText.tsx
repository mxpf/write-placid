import { Fragment, type ReactNode } from "react";
import { parseCaptionMarkdown } from "../lib/markdown.mjs";
import { guardTypographyString } from "../lib/typography.mjs";

export function CaptionText({ text }: { text: string }) {
  const runs = parseCaptionMarkdown(text);
  const content = (run: (typeof runs)[number], key: number) => run.italic
    ? <em key={key}>{guardTypographyString(run.text)}</em>
    : <Fragment key={key}>{guardTypographyString(run.text)}</Fragment>;
  const rendered: ReactNode[] = [];
  for (let index = 0; index < runs.length;) {
    const href = runs[index].href;
    if (!href) {
      rendered.push(content(runs[index], index));
      index += 1;
      continue;
    }
    const start = index;
    const label: ReactNode[] = [];
    while (index < runs.length && runs[index].href === href) {
      label.push(content(runs[index], index));
      index += 1;
    }
    const external = !href.startsWith("/") && !href.startsWith("#");
    rendered.push(<a key={start} href={href} rel={external ? "noreferrer" : undefined}>{label}</a>);
  }
  return rendered;
}
