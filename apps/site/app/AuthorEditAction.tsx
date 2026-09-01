import { STUDIO_URL } from "../site-config.mjs";
import { sitePath } from "./site-path";

export function AuthorEditAction() {
  return (
    <p className="author-edit-action" hidden>
      <a href={STUDIO_URL || sitePath("/")}>Edit</a>
    </p>
  );
}
