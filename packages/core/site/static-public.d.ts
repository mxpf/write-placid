import type { StaticPublicEnhancementOptions } from "./static-public-browser.mjs";

export interface StaticPublicBuildOptions {
  sourceDirectory: string;
  outputDirectory: string;
  publicBasePath?: string;
  canvasColor?: string;
  colorScheme?: "normal" | "light" | "dark" | "light dark" | "dark light";
  viewTransitions?: boolean;
  enhancements?: Omit<StaticPublicEnhancementOptions, "window" | "document">;
}

export interface StaticPublicVerification { htmlFiles: number; files: number; frameworkRuntimeRemoved: true; }
export declare function buildStaticPublic(options: StaticPublicBuildOptions): Promise<StaticPublicVerification>;
export declare function verifyStaticPublic(options: { outputDirectory: string; publicBasePath?: string }): Promise<StaticPublicVerification>;
