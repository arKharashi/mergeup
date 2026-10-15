import type { ReactNode } from 'react';

// **bold** (which may hold `code`), or `code`.
const MARKS = /\*\*((?:[^*`]|`[^`]*`)+)\*\*|`([^`]+)`/g;

/** Arabic UI copy: `code` becomes <code> (isolated LTR by the CSS) and **bold** becomes <strong>. */
export function Md({ text }: { text: string }): ReactNode {
  return parse(text);
}

function parse(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(MARKS)) {
    if (m.index > at) nodes.push(text.slice(at, m.index));
    nodes.push(m[1] !== undefined ? <strong key={m.index}>{parse(m[1])}</strong> : <code key={m.index}>{m[2]}</code>);
    at = m.index + m[0].length;
  }
  if (at < text.length) nodes.push(text.slice(at));
  return nodes;
}
