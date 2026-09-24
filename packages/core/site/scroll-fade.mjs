export const scrollFadeDefaults = Object.freeze({
  minimumOpacity: 0.6,
  fullyVisibleRatio: 2 / 3,
  thresholdSteps: 100,
  opacityProperty: "--article-image-opacity",
  activeAttribute: "data-scroll-fade-active",
});

function resetElement(element, opacityProperty, activeAttribute) {
  element.removeAttribute(activeAttribute);
  element.style.removeProperty(opacityProperty);
}

export function attachScrollFade(element, options = {}) {
  const minimumOpacity = options.minimumOpacity ?? scrollFadeDefaults.minimumOpacity;
  const fullyVisibleRatio = options.fullyVisibleRatio ?? scrollFadeDefaults.fullyVisibleRatio;
  const thresholdSteps = options.thresholdSteps ?? scrollFadeDefaults.thresholdSteps;
  const opacityProperty = options.opacityProperty ?? scrollFadeDefaults.opacityProperty;
  const activeAttribute = options.activeAttribute ?? scrollFadeDefaults.activeAttribute;
  const observerClass = options.IntersectionObserver ?? globalThis.IntersectionObserver;
  const matchMedia = options.matchMedia ?? globalThis.matchMedia?.bind(globalThis);

  if (!element || typeof observerClass !== "function" || minimumOpacity < 0 || minimumOpacity > 1 || fullyVisibleRatio <= 0 || thresholdSteps < 1) {
    return () => {};
  }

  try {
    if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};
  } catch {
    return () => {};
  }

  const thresholds = Array.from({ length: thresholdSteps + 1 }, (_, index) => index / thresholdSteps);
  let active = true;
  let observer;

  try {
    observer = new observerClass(([entry]) => {
      if (!active || !entry) return;
      const ratio = Math.max(0, Math.min(entry.intersectionRatio ?? 0, fullyVisibleRatio));
      const progress = ratio / fullyVisibleRatio;
      const opacity = minimumOpacity + ((1 - minimumOpacity) * progress);
      element.style.setProperty(opacityProperty, String(opacity));
    }, { threshold: thresholds });
    observer.observe(element);
    element.style.setProperty(opacityProperty, String(minimumOpacity));
    element.setAttribute(activeAttribute, "");
  } catch {
    active = false;
    observer?.disconnect?.();
    resetElement(element, opacityProperty, activeAttribute);
    return () => {};
  }

  return () => {
    if (!active) return;
    active = false;
    try {
      observer.disconnect();
    } finally {
      resetElement(element, opacityProperty, activeAttribute);
    }
  };
}
