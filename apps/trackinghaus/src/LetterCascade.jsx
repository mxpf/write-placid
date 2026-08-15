export function LetterCascade({ text }) {
  return (
    <span className="letter-cascade is-in" aria-label={text}>
      {Array.from(text).map((character, index) => (
        <b
          aria-hidden="true"
          key={`${character}-${index}`}
          style={{ "--letter-cascade-index": index }}
        >
          {character === " " ? "\u00a0" : character}
        </b>
      ))}
    </span>
  );
}
