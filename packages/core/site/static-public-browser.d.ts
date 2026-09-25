import type { ScrollFadeOptions } from "./scroll-fade.mjs";

export interface StaticPublicEnhancementOptions {
  typographyGuards?: boolean;
  scrollProgress?: boolean;
  scrollProgressSelector?: string;
  scrollFade?: boolean;
  scrollFadeSelector?: string;
  scrollFadeOptions?: ScrollFadeOptions;
  footerReveal?: boolean;
  footerSelector?: string;
  window?: Window;
  document?: Document;
}

export declare function enhanceStaticPublic(options?: StaticPublicEnhancementOptions): () => void;
