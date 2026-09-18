const hyphenBetweenWords = /(?<=[\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu;
const unguardedEnDash = /(?<!\u2060)–(?!\u2060)/gu;

/** @param {string} value */
export function guardTypographyString(value) {
  return value
    .replace(hyphenBetweenWords, "‑")
    .replace(unguardedEnDash, "\u2060–\u2060");
}
