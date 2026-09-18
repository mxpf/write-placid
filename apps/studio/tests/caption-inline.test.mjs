import assert from "node:assert/strict";
import test from "node:test";
import { captionToHtml, captionToText, parseCaption, captionRunsToMarkdown, captionDomToMarkdown, safeCaptionHref } from "../app/caption-inline.ts";
import { articleImageMarkdown, parseArticleImage } from "../app/article-images.ts";
import { markdownToEditorHtml } from "../app/rich-text.ts";

const text = nodeValue => ({ nodeType: 3, nodeValue });
const element = (tagName, childNodes = [], attributes = {}, style = {}) => ({ nodeType: 1, tagName, childNodes, style, getAttribute: name => attributes[name] || null });
const body = (...children) => element("BODY", children);

test("legacy image caption renders italics and its existing destination without a migration", () => {
  const caption = 'Sam Lowry’s executive decision maker in *Brazil* (1985), directed by Terry Gilliam. Film still via [mitxela](https://mitxela.com/projects/execucalm). Copyright remains with the film’s respective rights holders.';
  const markdown = `![Description](/images/original.jpg "${caption}")`;
  assert.equal(parseArticleImage(markdown).title, caption);
  const html = markdownToEditorHtml(markdown);
  assert.match(html, /<em>Brazil<\/em>/);
  assert.match(html, /<a href="https:\/\/mitxela.com\/projects\/execucalm" rel="noopener noreferrer">mitxela<\/a>/);
  assert.equal(captionToText(caption).includes('*Brazil*'), false);
});

test("caption text, italics, links and italic link labels survive canonical serialization", () => {
  const cases = ['Plain caption', '*Brazil* (1985)', '_Brazil_ and snake_case', '[*Film still* credit](https://example.com/a\\(b\\)?x=1&y=2)', '*Before [credit](https://example.com) after*', String.raw`Literal \*stars\*, \[brackets\], \(parens\), \_under\_ and \\ slash.`];
  for (const caption of cases) {
    const before = parseCaption(caption);
    const serialized = captionRunsToMarkdown(before);
    const letters = runs => runs.flatMap(run => [...run.text].map(char => ({ char, href: run.href, italic: /\s/.test(char) ? false : Boolean(run.italic) })));
    assert.deepEqual(letters(parseCaption(serialized)), letters(before), caption);
  }
});

test("optional title layer preserves quotes, backslashes, literal Markdown and image source", () => {
  const image = { src: '/images/original.jpg', alt: 'Plain description', title: String.raw`"A quote" and \*literal stars\* with C:\\Temp and [credit](https://example.com/a\(b\))` };
  assert.deepEqual(parseArticleImage(articleImageMarkdown(image)), image);
  assert.equal(captionToText(parseArticleImage(articleImageMarkdown(image)).title), '"A quote" and *literal stars* with C:\\Temp and credit');
  assert.equal(parseArticleImage('![Old](/images/a.jpg "An older caption")').title, 'An older caption');
});

test("unsafe links remain inert text and HTML never becomes executable", () => {
  for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'vbscript:bad', '//evil.example', '/\\evil.example', 'https://example.com/\n', 'doc:private']) {
    assert.equal(safeCaptionHref(href), null);
    assert.doesNotMatch(captionToHtml(`[click](${href})`), /<a /);
  }
  assert.equal(safeCaptionHref('java\nscript:alert(1)'), null);
  const html = captionToHtml('<img src=x onerror=alert(1)> <script>alert(1)</script> & "quoted"');
  assert.doesNotMatch(html, /<(?:script|img)/);
  assert.match(html, /&lt;script&gt;/);
});

test("safe destinations preserve values and escape HTML attributes", () => {
  for (const href of ['https://example.com/a?x=1&y=2', 'http://example.com', 'mailto:someone@example.com', '/articles/one', '#caption']) assert.equal(safeCaptionHref(href), href);
  assert.match(captionToHtml('[credit](https://example.com/a?x=1&y=2)'), /href="https:\/\/example.com\/a\?x=1&amp;y=2"/);
  for (const href of ['https://example.com/"onclick="x', '/bad path', 'https:\\evil.example', 'https://example.com/\u0001']) assert.equal(safeCaptionHref(href), null);
});

test("unsupported Markdown stays literal, including bold and images", () => {
  for (const caption of ['**Bold**', '![image](https://example.com/a.jpg)', '# Heading', '`code`', 'snake_case_name']) assert.equal(captionToText(caption), caption);
  assert.doesNotMatch(captionToHtml('**Bold**'), /<em>/);
});

test("pasted rich text retains only text, italics and safe links", () => {
  const pasted = body(element('P', [text('A '), element('STRONG', [text('bold')]), text(' '), element('SPAN', [text('film')], {}, { fontStyle: 'italic' })]), element('DIV', [element('A', [element('EM', [text('credit')])], { href: 'https://example.com' }), element('IMG', [], { src: 'x', onerror: 'alert(1)' }), element('SCRIPT', [text('alert(1)')]), element('A', [text(' unsafe')], { href: 'javascript:alert(1)' })]));
  const markdown = captionDomToMarkdown(pasted);
  assert.equal(markdown, 'A bold *film* [*credit*](https://example.com) unsafe');
  assert.doesNotMatch(captionToHtml(markdown), /script|javascript|<img|<strong/);
});

test("removing a link retains its label and italics, and clearing a caption yields empty text", () => {
  const linked = body(element('A', [text('A '), element('EM', [text('film')])], { href: '/credit' }));
  const unlinked = body(text('A '), element('EM', [text('film')]));
  assert.equal(captionDomToMarkdown(linked), '[A *film*](/credit)');
  assert.equal(captionDomToMarkdown(unlinked), 'A *film*');
  assert.equal(captionDomToMarkdown(body(element('BR'))), '');
});
