import { SITE_NAME } from "../site-config.mjs";
import { LetterCascade } from "./LetterCascade";
import { sitePath } from "./site-path";

export function SiteBrand() {
  return (
    <a className="desktop-brand" href={sitePath("/")}>
      <LetterCascade text={SITE_NAME} />
    </a>
  );
}
