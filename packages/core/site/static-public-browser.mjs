import { attachScrollFade } from "./scroll-fade.mjs";

const typographySkippedTags = new Set([
  "BUTTON", "CODE", "INPUT", "OPTION", "PRE", "SCRIPT", "SELECT", "STYLE", "SVG", "TEXTAREA",
]);
const hyphenBetweenWords = /(?<=[\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu;
const unguardedEnDash = /(?<!\u2060)–(?!\u2060)/gu;

function installTypographyGuards(document) {
  const guard = (node) => {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (typographySkippedTags.has(element.tagName) || element.isContentEditable || element.hasAttribute("data-preserve-typography")) return;
    }
    if (!node.nodeValue) return;
    node.nodeValue = node.nodeValue.replace(hyphenBetweenWords, "‑").replace(unguardedEnDash, "\u2060–\u2060");
  };
  const guardIn = (root) => {
    if (root.nodeType === globalThis.Node.TEXT_NODE) return guard(root);
    const walker = document.createTreeWalker(root, globalThis.NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) guard(node);
  };
  guardIn(document.body);
  const observer = new globalThis.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") guard(record.target);
      else for (const node of record.addedNodes) guardIn(node);
    }
  });
  observer.observe(document.body, { characterData: true, childList: true, subtree: true });
  return () => observer.disconnect();
}

function installScrollProgress(window, document, selector) {
  const element = document.querySelector(selector);
  if (!element) return () => {};
  let animationFrame = 0;
  const update = () => {
    animationFrame = 0;
    const root = document.documentElement;
    const height = root.scrollHeight - root.clientHeight;
    const value = height > 0 ? Math.min(1, Math.max(0, root.scrollTop / height)) : 0;
    element.style.setProperty("--scroll-progress", String(value));
  };
  const schedule = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
  };
  schedule();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

function installFooterReveal(window, document, selector, reducedMotion) {
  const footer = document.querySelector(selector);
  if (!footer || reducedMotion) return () => {};
  const reveal = () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    if (distance <= 1) footer.classList.add("is-revealed");
  };
  const frame = window.requestAnimationFrame(() => {
    footer.classList.add("is-armed");
    reveal();
  });
  window.addEventListener("scroll", reveal, { passive: true });
  window.addEventListener("resize", reveal);
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", reveal);
    window.removeEventListener("resize", reveal);
    footer.classList.remove("is-armed", "is-revealed");
  };
}

export function enhanceStaticPublic(options = {}) {
  const window = options.window ?? globalThis.window;
  const document = options.document ?? globalThis.document;
  if (!window || !document?.body) return () => {};
  let reducedMotion = true;
  try {
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {}

  const cleanups = [];
  if (options.typographyGuards !== false && globalThis.MutationObserver) cleanups.push(installTypographyGuards(document));
  if (options.scrollProgress !== false) cleanups.push(installScrollProgress(window, document, options.scrollProgressSelector ?? ".scroll-progress"));
  if (options.scrollFade !== false) {
    for (const image of document.querySelectorAll(options.scrollFadeSelector ?? ".article-image")) {
      cleanups.push(attachScrollFade(image, options.scrollFadeOptions));
    }
  }
  if (options.footerReveal !== false) cleanups.push(installFooterReveal(window, document, options.footerSelector ?? ".footer--end-reveal", reducedMotion));
  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}
