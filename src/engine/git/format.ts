import { countChanges, editOps, hunks, lines, treeDiff } from '../diff';
import { sha, short } from '../hash';
import type { Out, Segment } from '../output';
import type { Tree } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** git's default date format, in Riyadh time (+0300), where the team works. */
export function gitDate(t: number): string {
  const d = new Date(t + 3 * 3600e3);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' +
    p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' ' +
    d.getUTCFullYear() + ' +0300'
  );
}

export function changeSummary(files: number, ins: number, del: number): string {
  let s = files + ' file' + (files === 1 ? '' : 's') + ' changed';
  if (ins || !del) s += ', ' + ins + ' insertion' + (ins === 1 ? '' : 's') + '(+)';
  if (del) s += ', ' + del + ' deletion' + (del === 1 ? '' : 's') + '(-)';
  return s;
}

export function printFileDiff(out: Out, path: string, oldS: string | undefined, newS: string | undefined): void {
  const isNew = oldS === undefined;
  const isDel = newS === undefined;
  out.line([['diff --git a/' + path + ' b/' + path, 'b']]);
  if (isNew) out.line([['new file mode 100644', 'b']]);
  if (isDel) out.line([['deleted file mode 100644', 'b']]);
  out.line([['index ' + short(sha(oldS ?? '')) + '..' + short(sha(newS ?? '')) + (isNew || isDel ? '' : ' 100644'), 'b']]);
  out.line([[isNew ? '--- /dev/null' : '--- a/' + path, 'b']]);
  out.line([[isDel ? '+++ /dev/null' : '+++ b/' + path, 'b']]);
  for (const h of hunks(editOps(lines(oldS), lines(newS)))) {
    out.line([['@@ -' + h.aStart + ',' + h.aCount + ' +' + h.bStart + ',' + h.bCount + ' @@', 'c']]);
    for (const o of h.ops) out.line([[o.t + o.s, o.t === '+' ? 'g' : o.t === '-' ? 'r' : '']]);
  }
}

export function printTreeDiff(out: Out, a: Tree, b: Tree, only?: string[]): void {
  for (const p of treeDiff(a, b, only)) printFileDiff(out, p, a[p], b[p]);
}

export function printStat(out: Out, a: Tree, b: Tree, only?: string[]): void {
  const paths = treeDiff(a, b, only);
  if (!paths.length) return;
  const width = Math.max(...paths.map((p) => p.length));
  const counts = paths.map((p) => countChanges(a[p], b[p]));
  const numWidth = Math.max(...counts.map((c) => String(c.ins + c.del).length));
  let ti = 0;
  let td = 0;
  paths.forEach((p, i) => {
    const { ins, del } = counts[i]!;
    ti += ins;
    td += del;
    const segs: Segment[] = [
      [' ' + p.padEnd(width) + ' | ' + String(ins + del).padStart(numWidth) + ' '],
      ['+'.repeat(Math.min(ins, 30)), 'g'],
      ['-'.repeat(Math.min(del, 30)), 'r'],
    ];
    out.line(segs);
  });
  out.print(' ' + changeSummary(paths.length, ti, td));
}
