import { describe, expect, it } from 'vitest';
import { countChanges, editOps, hunks, lines, treeDiff } from '../src/engine';

describe('diff', () => {
  it('splits lines without the trailing newline', () => {
    expect(lines('a\nb\n')).toEqual(['a', 'b']);
    expect(lines('')).toEqual([]);
    expect(lines(undefined)).toEqual([]);
  });

  it('finds a changed line', () => {
    const ops = editOps(['a', 'b', 'c'], ['a', 'B', 'c']);
    expect(ops.map((o) => o.t + o.s)).toEqual([' a', '-b', '+B', ' c']);
  });

  it('builds unified hunks with line numbers', () => {
    const a = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const b = [...a];
    b[4] = 'five';
    const [h] = hunks(editOps(a, b));
    expect(h).toMatchObject({ aStart: 2, aCount: 7, bStart: 2, bCount: 7 });
  });

  it('counts insertions and deletions', () => {
    expect(countChanges('a\nb\n', 'a\nc\nd\n')).toEqual({ ins: 2, del: 1 });
    expect(countChanges(undefined, 'x\n')).toEqual({ ins: 1, del: 0 });
  });

  it('lists changed paths', () => {
    expect(treeDiff({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' })).toEqual(['b', 'c']);
    expect(treeDiff({ a: '1', b: '2' }, { a: '9', b: '3' }, ['b'])).toEqual(['b']);
  });
});
