import { lines, type Tree } from '../engine';

/** One CI check on a commit: its name, whether it passed, and what it printed (English, like tool output). */
export interface Check {
  name: string;
  ok: boolean;
  output: string[];
}

/** Statements the team's linter refuses in shipped code. */
const RULES: [RegExp, string, string][] = [
  [/\bconsole\.(log|debug|info|warn)\s*\(/, 'Unexpected console statement', 'no-console'],
  [/\bdebugger\b/, "Unexpected 'debugger' statement", 'no-debugger'],
];

/**
 * The team's CI, the quality checker in docs/design.md: it lints every JavaScript file in the commit,
 * and a red check blocks the merge. The output follows ESLint's default format.
 */
export function runChecks(tree: Tree): Check[] {
  const output: string[] = [];
  let problems = 0;
  for (const path of Object.keys(tree).filter((p) => p.endsWith('.js')).sort()) {
    const found: string[] = [];
    lines(tree[path]).forEach((text, i) => {
      for (const [re, message, rule] of RULES) {
        const m = re.exec(text);
        if (m) found.push('  ' + (i + 1) + ':' + (m.index + 1) + '  error  ' + message + '  ' + rule);
      }
    });
    if (!found.length) continue;
    problems += found.length;
    output.push(path, ...found, '');
  }
  const s = (n: number) => (n === 1 ? '' : 's');
  if (problems) output.push('✖ ' + problems + ' problem' + s(problems) + ' (' + problems + ' error' + s(problems) + ', 0 warnings)');
  else output.push('No problems found.');
  return [{ name: 'CI / lint', ok: !problems, output }];
}
