import { Fragment, type ReactNode } from "react";
import { GLOSSARY } from "@/config/glossary";

/**
 * A word with its meaning: dotted underline, the meaning on hover, on focus and on tap. A button, so it works from
 * the keyboard and on phones, and reads its meaning to a screen reader through aria-describedby. Plain CSS
 * (src/styles/glossary.css): it needs no JavaScript.
 */
export function Term({ id, meaning, children }: { id: string; meaning: string; children: ReactNode }) {
  return (
    <span className="term">
      <button aria-describedby={id} className="term__word" type="button">
        {children}
      </button>
      <span className="term__meaning" id={id} role="tooltip">
        {meaning}
      </span>
    </span>
  );
}

const MATCHER = new RegExp(
  `\\b(${[...GLOSSARY]
    .sort((a, b) => b.term.length - a.term.length)
    .map((entry) => `(?:${entry.pattern})`)
    .join("|")})\\b`,
  "gi",
);

function entryFor(word: string) {
  return GLOSSARY.find((entry) => new RegExp(`^(?:${entry.pattern})$`, "i").test(word));
}

/** The text with the first use of each glossary term marked with its meaning. */
export function glossed(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const match of text.matchAll(MATCHER)) {
    const entry = entryFor(match[0]);
    if (!entry || seen.has(entry.term)) continue;
    seen.add(entry.term);
    const start = match.index;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <Term id={`${prefix}-${entry.term.replace(/\W+/g, "-")}`} key={start} meaning={entry.meaning}>
        {match[0]}
      </Term>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** A sentence or two with its glossary terms explained. `prefix` keeps the tooltip ids unique on the page. */
export function Glossed({ text, prefix = "term" }: { text: string; prefix?: string }) {
  return (
    <>
      {glossed(text, prefix).map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </>
  );
}
