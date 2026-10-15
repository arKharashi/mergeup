import type { Tree } from './types';

/** Splits file content into lines, ignoring the final newline. */
export function lines(s: string | undefined | null): string[] {
  if (s == null || s === '') return [];
  const a = s.split('\n');
  if (a[a.length - 1] === '') a.pop();
  return a;
}

export interface EditOp {
  t: ' ' | '+' | '-';
  s: string;
  /** Index in the old file where this op sits. */
  ai: number;
  /** Index in the new file where this op sits. */
  bi: number;
}

/** Line diff via longest common subsequence. Files in the game are small. */
export function editOps(a: string[], b: string[]): EditOp[] {
  const n = a.length;
  const m = b.length;
  const dp: Int32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: EditOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: ' ', s: a[i]!, ai: i, bi: j });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ t: '-', s: a[i]!, ai: i, bi: j });
      i++;
    } else {
      ops.push({ t: '+', s: b[j]!, ai: i, bi: j });
      j++;
    }
  }
  while (i < n) ops.push({ t: '-', s: a[i]!, ai: i++, bi: j });
  while (j < m) ops.push({ t: '+', s: b[j]!, ai: i, bi: j++ });
  return ops;
}

export interface Hunk {
  aStart: number;
  aCount: number;
  bStart: number;
  bCount: number;
  ops: EditOp[];
}

/** Groups edit ops into unified-diff hunks with `ctx` lines of context. */
export function hunks(ops: EditOp[], ctx = 3): Hunk[] {
  const changed: number[] = [];
  ops.forEach((o, k) => {
    if (o.t !== ' ') changed.push(k);
  });
  if (!changed.length) return [];
  const ranges: [number, number][] = [];
  let start = Math.max(0, changed[0]! - ctx);
  let end = Math.min(ops.length - 1, changed[0]! + ctx);
  for (const k of changed.slice(1)) {
    if (k - ctx <= end + 1) {
      end = Math.min(ops.length - 1, k + ctx);
    } else {
      ranges.push([start, end]);
      start = Math.max(0, k - ctx);
      end = Math.min(ops.length - 1, k + ctx);
    }
  }
  ranges.push([start, end]);
  return ranges.map(([s, e]) => {
    const seg = ops.slice(s, e + 1);
    const first = seg[0]!;
    const aCount = seg.filter((o) => o.t !== '+').length;
    const bCount = seg.filter((o) => o.t !== '-').length;
    return {
      aStart: aCount ? first.ai + 1 : first.ai,
      aCount,
      bStart: bCount ? first.bi + 1 : first.bi,
      bCount,
      ops: seg,
    };
  });
}

export function countChanges(oldS: string | undefined, newS: string | undefined): { ins: number; del: number } {
  let ins = 0;
  let del = 0;
  for (const o of editOps(lines(oldS), lines(newS))) {
    if (o.t === '+') ins++;
    else if (o.t === '-') del++;
  }
  return { ins, del };
}

/** Paths whose content differs between two trees, sorted. `only` limits to some paths. */
export function treeDiff(a: Tree, b: Tree, only?: string[]): string[] {
  const all = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return all.filter((p) => (!only || !only.length || only.includes(p)) && a[p] !== b[p]);
}
