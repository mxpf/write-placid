import webmentionCache from "../data/webmentions.json";

type Webmention = {
  url: string;
  label: string;
  received?: string;
};

type WebmentionCache = {
  posts: Record<string, Webmention[]>;
};

export function Webmentions({ slug }: { slug: string }) {
  const mentions = (webmentionCache as WebmentionCache).posts[slug] ?? [];
  if (mentions.length === 0) return null;

  return (
    <section className="webmentions" aria-labelledby="webmentions-title">
      <h2 id="webmentions-title">Mentioned by</h2>
      <ul>
        {mentions.map((mention) => (
          <li key={mention.url}>
            <a href={mention.url} rel="noreferrer">{mention.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
