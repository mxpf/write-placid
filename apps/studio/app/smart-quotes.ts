const markdownDestinationPattern = /\]\(([^)\s]+)\)/g;

function smartenProse(value: string) {
  return value
    .replace(/(^|[\s([{—])"(?=\S)/gu, "$1“")
    .replace(/"/g, "”")
    .replace(/([\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, "$1’")
    .replace(/(^|[\s([{—])'(?=\S)/gu, "$1‘")
    .replace(/'/g, "’");
}

export function smartenQuotes(value: string) {
  const destinations: string[] = [];
  const protectedValue = value.replace(markdownDestinationPattern, (match) => {
    destinations.push(match);
    return `\uE000${destinations.length - 1}\uE001`;
  });

  return smartenProse(protectedValue).replace(/\uE000(\d+)\uE001/g, (_, index) =>
    destinations[Number(index)] ?? "",
  );
}

export function smartQuoteForInput(quote: "\"" | "'", previousCharacter = "") {
  const opensQuote = !previousCharacter || /[\s([{—]/u.test(previousCharacter);
  if (quote === "\"") return opensQuote ? "“" : "”";
  return opensQuote ? "‘" : "’";
}
