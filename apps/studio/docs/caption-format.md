# Image caption format

Studio and the public renderer use the same restricted inline Markdown contract. The image description remains plain text. Captions remain in the existing optional image title:

    ![Description](/images/photo.jpg "Caption with *italics* and [credit](https://example.com)")

Supported caption syntax:

- Plain text and single-delimiter emphasis: `*text*` or `_text_`. Intraword underscores are literal.
- Inline links: `[label](destination)`. Labels may contain emphasis. Balanced or backslash-escaped destination parentheses are supported.
- Backslash escapes for `\`, `*`, `_`, `[`, `]`, `(` and `)`.
- No interpreted raw HTML, bold, images, headings, code, or block markup. Unsupported syntax displays as text.

Destinations allow `http:`, `https:`, `mailto:`, a single-leading-slash root-relative path, or a `#fragment`. Protocol-relative addresses, other protocols, whitespace/control characters, backslashes, quotes, and angle brackets are rejected. Use URL percent encoding for literal quotes or spaces. Unsafe authored link syntax is displayed as inert text; unsafe pasted anchors retain their text without a link.

There are two escaping layers. First serialize inline caption Markdown, escaping literal punctuation and destination parentheses. Then escape every backslash and ASCII double quote for the outer image-title string. Reading removes only the outer escaped quotes/backslashes before parsing caption Markdown. This preserves literal asterisks, quotes, and backslashes without replacing wording with curly punctuation. Existing captions require no migration.

The editor renders from the safe inline parser. Pasted HTML is parsed in an inert document and reduced to text, italics, and allowed links; executable/media elements are omitted. Plain-text paste remains literal text. Link controls appear inline inside the image dialog. Applying a link commits only the local caption edit; Save image commits the caption to the body, and the existing save queue persists it. Cancel/Escape on link controls discards that URL edit; Cancel/Escape on the image dialog discards all uncommitted image details.
