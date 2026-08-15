import type { CSSProperties } from "react";

type LetterCascadeProps = {
  text: string;
};

export function LetterCascade({ text }: LetterCascadeProps) {
  return (
    <span className="letter-cascade is-in" aria-label={text}>
      {Array.from(text).map((character, index) => (
        <b
          aria-hidden="true"
          key={`${character}-${index}`}
          style={{ "--letter-cascade-index": index } as CSSProperties}
        >
          {character === " " ? "\u00a0" : character}
        </b>
      ))}
    </span>
  );
}
