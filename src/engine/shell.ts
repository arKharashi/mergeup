import type { Ctx } from './context';
import { git } from './git';
import { inRepo } from './repo';

/**
 * Splits a command line into words. Handles 'single' and "double" quotes,
 * and turns && ; > >> into their own tokens. Returns null on an unclosed quote.
 */
export function tokenize(s: string): string[] | null {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let quoted = false;
  const flush = () => {
    if (cur || quoted) out.push(cur);
    cur = '';
    quoted = false;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      quoted = true;
    } else if (/\s/.test(ch)) {
      flush();
    } else if (ch === '>') {
      flush();
      if (s[i + 1] === '>') {
        out.push('>>');
        i++;
      } else out.push('>');
    } else if (ch === '&' && s[i + 1] === '&') {
      flush();
      out.push('&&');
      i++;
    } else if (ch === ';') {
      flush();
      out.push('&&');
    } else {
      cur += ch;
    }
  }
  if (quote) return null;
  flush();
  return out;
}

/** Phones and Arabic keyboards insert curly quotes and no-break spaces. */
export const normalizeInput = (s: string): string =>
  s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/ /g, ' ');

/** Runs one line typed by the player. */
export function runLine(ctx: Ctx, raw: string): void {
  const toks = tokenize(normalizeInput(raw));
  if (toks === null) {
    ctx.out.print('bash: unexpected EOF while looking for matching quote', 'r');
    ctx.out.tip('فيه علامة تنصيص `"` مفتوحة وما تسكّرت.');
    return;
  }
  const commands: string[][] = [[]];
  for (const t of toks) {
    if (t === '&&') commands.push([]);
    else commands[commands.length - 1]!.push(t);
  }
  for (const args of commands) {
    if (!args.length) continue;
    let ok: boolean;
    try {
      ok = exec(ctx, args);
    } catch (err) {
      ctx.out.print('error: ' + (err instanceof Error ? err.message : String(err)), 'r');
      ok = false;
    }
    if (!ok) break;
  }
}

export const SHELL_COMMANDS = ['git', 'ls', 'cd', 'cat', 'echo', 'pwd', 'touch', 'rm', 'clear', 'help', 'whoami'];

function exec(ctx: Ctx, args: string[]): boolean {
  const [cmd, ...rest] = args as [string, ...string[]];
  switch (cmd) {
    case 'git':
      return git(ctx, rest);
    case 'ls':
      return ls(ctx, rest);
    case 'cd':
      return cd(ctx, rest[0]);
    case 'pwd':
      ctx.out.print('/home/dev' + ctx.world.cwd.slice(1));
      return true;
    case 'cat':
      return cat(ctx, rest);
    case 'echo':
      return echo(ctx, rest);
    case 'touch':
      return touch(ctx, rest);
    case 'rm':
      return rm(ctx, rest);
    case 'clear':
      ctx.out.clear();
      return true;
    case 'whoami':
      ctx.out.print('dev');
      return true;
    case 'help':
      return help(ctx);
    case 'mkdir':
    case 'nano':
    case 'vim':
    case 'vi':
    case 'code':
    case 'open':
      ctx.out.print('bash: ' + cmd + ': command not available here', 'r');
      ctx.out.tip('عدّل الملفات من لوحة «الملفات»، أو بـ `echo "نص" >> file`.');
      return false;
    default:
      ctx.out.print('bash: ' + cmd + ': command not found', 'r');
      if (/^(status|add|commit|push|pull|log|clone|diff|show)$/.test(cmd)) ctx.out.tip('نسيت كلمة `git` قبل الأمر. جرّب: `git ' + cmd + '`');
      else ctx.out.tip('اكتب `help` تشوف الأوامر المتاحة.');
      return false;
  }
}

function needRepoFile(ctx: Ctx, name: string, cmd: string): boolean {
  if (inRepo(ctx.world)) return true;
  ctx.out.print(cmd + ': ' + name + ': No such file or directory', 'r');
  if (ctx.world.local) ctx.out.tip('الملفات داخل مجلد المشروع. ادخله أول: `cd ' + ctx.world.local.dir + '`');
  return false;
}

function ls(ctx: Ctx, args: string[]): boolean {
  const { world, out } = ctx;
  const all = args.some((a) => /^-\w*a/.test(a));
  if (!inRepo(world)) {
    if (world.local) out.line([[world.local.dir + '/', 'bl']]);
    else out.tip('المجلد فاضي. المشروع لسا ما انسحب لجهازك.');
    return true;
  }
  const names = Object.keys(world.local!.work).sort();
  const shown = all ? ['./', '../', '.git/', ...names] : names.filter((n) => !n.startsWith('.'));
  out.line(shown.map((n, i) => [(i ? '  ' : '') + n, n.endsWith('/') ? 'bl' : ''] as const));
  return true;
}

function cd(ctx: Ctx, target: string | undefined): boolean {
  const { world, out } = ctx;
  const t = (target ?? '~').replace(/\/+$/, '') || '/';
  if (['~', '/home/dev', '..', '/', '-'].includes(t)) {
    world.cwd = '~';
    return true;
  }
  if (t === '.') return true;
  const name = t.replace(/^\.\//, '').replace(/^~\//, '').replace(/^\/home\/dev\//, '');
  if (world.local && name === world.local.dir && (world.cwd === '~' || t.startsWith('~/') || t.startsWith('/home/dev/'))) {
    world.cwd = '~/' + world.local.dir;
    return true;
  }
  out.print('bash: cd: ' + target + ': No such file or directory', 'r');
  if (world.local && name === world.local.dir) out.tip('أنت أصلاً داخل `' + world.local.dir + '`.');
  else if (!world.local && name === 'bun-cafe') out.tip('المجلد ما انوجد لأنك ما استنسخت المشروع للحين.');
  return false;
}

function cat(ctx: Ctx, files: string[]): boolean {
  if (!files.length) {
    ctx.out.print('cat: missing file operand', 'r');
    return false;
  }
  let ok = true;
  for (const f of files) {
    if (!needRepoFile(ctx, f, 'cat')) return false;
    const content = ctx.world.local!.work[f];
    if (content === undefined) {
      ctx.out.print('cat: ' + f + ': No such file or directory', 'r');
      ok = false;
      continue;
    }
    if (content) ctx.out.print(content.replace(/\n$/, ''));
  }
  return ok;
}

function echo(ctx: Ctx, args: string[]): boolean {
  const k = args.findIndex((a) => a === '>' || a === '>>');
  if (k < 0) {
    ctx.out.print(args.join(' '));
    return true;
  }
  const text = args.slice(0, k).join(' ');
  const file = args[k + 1];
  if (!file) {
    ctx.out.print("bash: syntax error near unexpected token `newline'", 'r');
    return false;
  }
  if (!needRepoFile(ctx, file, 'bash')) return false;
  const w = ctx.world.local!.work;
  if (args[k] === '>') {
    w[file] = text + '\n';
  } else {
    const prev = w[file] ?? '';
    w[file] = prev + (prev && !prev.endsWith('\n') ? '\n' : '') + text + '\n';
  }
  return true;
}

function touch(ctx: Ctx, files: string[]): boolean {
  for (const f of files) {
    if (!needRepoFile(ctx, f, 'touch')) return false;
    const w = ctx.world.local!.work;
    if (!(f in w)) w[f] = '';
  }
  return true;
}

function rm(ctx: Ctx, args: string[]): boolean {
  const files = args.filter((a) => !a.startsWith('-'));
  if (!files.length) {
    ctx.out.print('rm: missing operand', 'r');
    return false;
  }
  for (const f of files) {
    if (!inRepo(ctx.world) || !(f in ctx.world.local!.work)) {
      ctx.out.print("rm: cannot remove '" + f + "': No such file or directory", 'r');
      return false;
    }
    delete ctx.world.local!.work[f];
  }
  return true;
}

function help(ctx: Ctx): boolean {
  const { out } = ctx;
  out.tip('الأوامر اللي تحتاجها في هذا المستوى:');
  for (const [c, d] of ctx.help) out.line([['  ' + c.padEnd(30), 'y'], [d, 'd']]);
  out.print('');
  out.line([['  ' + SHELL_COMMANDS.filter((c) => c !== 'git' && c !== 'help').join(', '), 'd']]);
  out.tip('الأسهم ↑ ↓ ترجّع أوامرك السابقة، و Tab يكمّل أسماء الملفات.');
  return true;
}
