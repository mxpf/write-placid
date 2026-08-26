"use client";

import { useEffect } from "react";

const skippedTags = new Set([
  "BUTTON",
  "CODE",
  "INPUT",
  "OPTION",
  "PRE",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "SVG",
  "TEXTAREA",
]);

const hyphenBetweenWords = /(?<=[\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu;
const unguardedEnDash = /(?<!\u2060)–(?!\u2060)/gu;

function shouldSkipTextNode(node: Text) {
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (
      skippedTags.has(element.tagName)
      || element.isContentEditable
      || element.hasAttribute("data-preserve-typography")
    ) {
      return true;
    }
  }

  return false;
}

export function guardTypography(node: Text) {
  if (shouldSkipTextNode(node)) return;

  const value = node.nodeValue;
  if (!value) return;

  const guarded = value
    .replace(hyphenBetweenWords, "‑")
    .replace(unguardedEnDash, "\u2060–\u2060");

  if (guarded !== value) node.nodeValue = guarded;
}

function guardTypographyIn(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    guardTypography(root as Text);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    guardTypography(node as Text);
    node = walker.nextNode();
  }
}

export function TypographyGuards() {
  useEffect(() => {
    guardTypographyIn(document.body);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          guardTypography(record.target as Text);
          continue;
        }

        for (const node of record.addedNodes) guardTypographyIn(node);
      }
    });

    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
