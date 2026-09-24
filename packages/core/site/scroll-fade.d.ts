export interface ScrollFadeElement {
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface ScrollFadeOptions {
  minimumOpacity?: number;
  fullyVisibleRatio?: number;
  thresholdSteps?: number;
  opacityProperty?: string;
  activeAttribute?: string;
  IntersectionObserver?: typeof globalThis.IntersectionObserver;
  matchMedia?: typeof globalThis.matchMedia;
}

export declare const scrollFadeDefaults: Readonly<Required<Omit<ScrollFadeOptions, "IntersectionObserver" | "matchMedia">>>;
export declare function attachScrollFade(element: ScrollFadeElement | null, options?: ScrollFadeOptions): () => void;
