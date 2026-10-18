import { useState, type FormEvent } from 'react';
import { compare, firstLine, lines, pullCommits, short, type Commit, type Person, type PullEvent, type PullRequest, type Review } from '../engine';
import { TEAM, npcName } from '../game/team';
import { useGame } from './gameContext';
import { useLang, type Lang } from './lang';
import { Md } from './Md';

type View = { kind: 'list' } | { kind: 'new'; head: string } | { kind: 'pull'; number: number };

const HOST = 'repo.bun.local/team/bun-cafe';

/** A teammate shows under their name in the player's language; the player under the name they typed. */
function who(p: Person, lang: Lang): { name: string; mark: string } {
  const npc = Object.values(TEAM).find((n) => n.email === p.email);
  if (npc) return { name: npcName(npc.id)[lang], mark: npc.mark[lang] };
  return { name: p.name, mark: p.name.trim().charAt(0) || '?' };
}

/** The title the host suggests: the commit's subject when there is one, else the branch name ("Feature/about"). */
const suggestedTitle = (head: string, commits: Commit[]) =>
  commits.length === 1 ? firstLine(commits[0]!.message) : head.charAt(0).toUpperCase() + head.slice(1).replace(/[-_]/g, ' ');

/**
 * The team repo's pull requests, as a page on the code host (repo.bun.local): open one from a pushed branch,
 * read the reviews and the CI checks, and merge. Give it key={session id}.
 */
export function RepoPage() {
  const game = useGame();
  const { t } = useLang();
  const pulls = game.pulls() ?? [];
  const [view, setView] = useState<View>(() => (pulls.length ? { kind: 'pull', number: pulls.at(-1)!.number } : { kind: 'list' }));

  let page;
  let path = HOST + '/pulls';
  const pr = view.kind === 'pull' ? pulls.find((p) => p.number === view.number) : undefined;
  if (view.kind === 'new') {
    path = HOST + '/compare/main...' + view.head;
    page = <NewPull head={view.head} onCancel={() => setView({ kind: 'list' })} onOpened={(n) => setView({ kind: 'pull', number: n })} />;
  } else if (pr) {
    path = HOST + '/pull/' + pr.number;
    page = <PullPage pr={pr} onBack={() => setView({ kind: 'list' })} />;
  } else {
    page = <PullList pulls={pulls} onOpen={(n) => setView({ kind: 'pull', number: n })} onCompare={(head) => setView({ kind: 'new', head })} />;
  }

  return (
    <section className="col col-web" aria-label={t({ ar: 'طلبات الدمج', en: 'Pull requests' })}>
      <div className="col-head webbar">
        <span className="lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="addr mono" dir="ltr">
          {path}
        </span>
      </div>
      <div className="web" id="web">
        {page}
      </div>
    </section>
  );
}

function PullList({ pulls, onOpen, onCompare }: { pulls: PullRequest[]; onOpen: (n: number) => void; onCompare: (head: string) => void }) {
  const game = useGame();
  const { t, lang } = useLang();
  const ready = game.session?.status === 'playing' ? game.pullCandidates() : [];
  return (
    <>
      <div className="repohead">
        <b className="mono" dir="ltr">
          team / bun-cafe
        </b>
        <span className="pill">
          <Md text={t({ ar: '`main` محمي', en: '`main` is protected' })} />
        </span>
      </div>
      {ready.map((head) => (
        <div className="banner" key={head}>
          <span>
            <Md text={t({ ar: 'فرع `' + head + '` فيه شغل ما انفتح له طلب دمج.', en: '`' + head + '` has work without a pull request.' })} />
          </span>
          <button type="button" className="btn primary" id="comparePr" onClick={() => onCompare(head)}>
            {t({ ar: 'افتح طلب دمج', en: 'Compare & pull request' })}
          </button>
        </div>
      ))}
      <h3 className="webtitle">{t({ ar: 'طلبات الدمج', en: 'Pull requests' })}</h3>
      {pulls.length ? (
        <ul className="prlist">
          {[...pulls].reverse().map((p) => (
            <li key={p.number}>
              <button type="button" onClick={() => onOpen(p.number)}>
                <StatePill pr={p} />
                <span className="prname" dir="auto">
                  {p.title}
                </span>
                <span className="muted mono">#{p.number}</span>
                <span className="muted">{who(p.author, lang).name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {t({ ar: 'ما فيه طلبات دمج للحين. أي فرع ترفعه بشغل جديد يظهر فوق، وتفتح له طلب.', en: 'No pull requests yet. A branch you push with new work shows up above, ready for one.' })}
        </p>
      )}
    </>
  );
}

function NewPull({ head, onCancel, onOpened }: { head: string; onCancel: () => void; onOpened: (n: number) => void }) {
  const game = useGame();
  const { t } = useLang();
  const remote = game.session!.world.remote;
  const base = remote.defaultBranch;
  const { commits, base: from, head: to } = compare(remote, remote.branches[base]!, remote.branches[head]!);
  const files = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((p) => from[p] !== to[p]).sort();
  const [title, setTitle] = useState(() => suggestedTitle(head, commits));
  const [body, setBody] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pr = game.openPull(head, title, body);
    if (pr) onOpened(pr.number);
  };

  return (
    <form className="newpr" onSubmit={submit}>
      <h3 className="webtitle">{t({ ar: 'طلب دمج جديد', en: 'Open a pull request' })}</h3>
      <p className="compare" dir="ltr">
        <code>{base}</code> ← <code>{head}</code>
      </p>
      <p className="muted">
        <Md
          text={t({
            ar: 'تطلب دمج `' + head + '` في `' + base + '`: ' + commits.length + ' commit، ' + files.length + ' ملف.',
            en: 'Asking to merge `' + head + '` into `' + base + '`: ' + commits.length + ' commit' + (commits.length === 1 ? '' : 's') + ', ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '.',
          })}
        />
      </p>
      <label htmlFor="prTitle">{t({ ar: 'العنوان', en: 'Title' })}</label>
      <input id="prTitle" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="prBody">{t({ ar: 'الوصف (اختياري)', en: 'Description (optional)' })}</label>
      <textarea id="prBody" dir="auto" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row">
        <button type="submit" className="btn primary" id="createPr" disabled={!title.trim()}>
          {t({ ar: 'أنشئ طلب الدمج', en: 'Create pull request' })}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t({ ar: 'إلغاء', en: 'Cancel' })}
        </button>
      </div>
      <CommitList commits={commits} />
    </form>
  );
}

function CommitList({ commits }: { commits: Commit[] }) {
  return (
    <ul className="commits">
      {commits.map((c) => (
        <li key={c.id}>
          <span className="mono muted">{short(c.id)}</span> <span dir="ltr">{firstLine(c.message)}</span>
        </li>
      ))}
    </ul>
  );
}

function StatePill({ pr }: { pr: PullRequest }) {
  const { t } = useLang();
  return pr.state === 'merged' ? (
    <span className="state merged">{t({ ar: 'مدموج', en: 'Merged' })}</span>
  ) : (
    <span className="state open">{t({ ar: 'مفتوح', en: 'Open' })}</span>
  );
}

function PullPage({ pr, onBack }: { pr: PullRequest; onBack: () => void }) {
  const game = useGame();
  const { t, lang } = useLang();
  const remote = game.session!.world.remote;
  const commits = pullCommits(remote, pr);
  const pushed = new Set(pr.events.flatMap((e) => (e.kind === 'push' ? e.commits : [])));
  const opened = commits.filter((c) => !pushed.has(c.id));
  const author = who(pr.author, lang);
  const n = commits.length;
  const merged = pr.events.find((e) => e.kind === 'merged');
  return (
    <div className="prpage" id="prPage">
      <button type="button" className="btn ghost back" id="prBack" onClick={onBack}>
        {t({ ar: '→ كل طلبات الدمج', en: '← All pull requests' })}
      </button>
      <h3 className="webtitle">
        <span dir="auto">{pr.title}</span> <span className="muted mono">#{pr.number}</span>
      </h3>
      <p className="prmeta">
        <StatePill pr={pr} />{' '}
        <Md
          text={
            merged
              ? t({
                  ar: author.name + ' دمج ' + n + ' commit في `' + pr.base + '` من `' + pr.head + '`',
                  en: author.name + ' merged ' + n + ' commit' + (n === 1 ? '' : 's') + ' into `' + pr.base + '` from `' + pr.head + '`',
                })
              : t({
                  ar: author.name + ' يبي يدمج ' + n + ' commit في `' + pr.base + '` من `' + pr.head + '`',
                  en: author.name + ' wants to merge ' + n + ' commit' + (n === 1 ? '' : 's') + ' into `' + pr.base + '` from `' + pr.head + '`',
                })
          }
        />
      </p>

      <ol className="timeline">
        <li className="event">
          <Avatar mark={author.mark} />
          <div className="ebody">
            <div className="ehead">
              <b>{author.name}</b> {t({ ar: 'فتح الطلب', en: 'opened this pull request' })}
            </div>
            <p className={pr.body ? '' : 'muted'} dir="auto">
              {pr.body || t({ ar: 'بدون وصف.', en: 'No description provided.' })}
            </p>
            <CommitList commits={opened} />
          </div>
        </li>
        {pr.events.map((e, i) => (
          <Event key={i} e={e} />
        ))}
      </ol>

      <Checks pr={pr} />
      <MergeBox pr={pr} />
    </div>
  );
}

function Avatar({ mark }: { mark: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {mark}
    </span>
  );
}

function Event({ e }: { e: PullEvent }) {
  const game = useGame();
  const { t, lang } = useLang();
  const remote = game.session!.world.remote;
  if (e.kind === 'review') return <ReviewEvent review={e.review} />;
  const by = who(e.kind === 'merged' ? e.by : game.session!.world.me, lang);
  if (e.kind === 'push') {
    const n = e.commits.length;
    return (
      <li className="event small">
        <Avatar mark={by.mark} />
        <div className="ebody">
          <div className="ehead">
            <b>{by.name}</b> {t({ ar: 'أضاف ' + n + ' commit', en: 'added ' + n + ' commit' + (n === 1 ? '' : 's') })}
          </div>
          <CommitList commits={e.commits.map((id) => remote.commits[id]!)} />
        </div>
      </li>
    );
  }
  return (
    <li className="event small merged">
      <Avatar mark={by.mark} />
      <div className="ebody">
        <div className="ehead">
          <b>{by.name}</b>{' '}
          <Md text={t({ ar: 'دمج الـ commit `' + short(e.commit) + '` في `main`', en: 'merged commit `' + short(e.commit) + '` into `main`' })} />
        </div>
      </div>
    </li>
  );
}

function ReviewEvent({ review }: { review: Review }) {
  const game = useGame();
  const { t, lang } = useLang();
  const by = who(review.by, lang);
  const tree = game.session!.world.remote.commits[review.commit]?.tree ?? {};
  const verb =
    review.state === 'approved'
      ? t({ ar: 'وافق على التعديلات', en: 'approved these changes' })
      : review.state === 'changes_requested'
        ? t({ ar: 'طلب تعديلات', en: 'requested changes' })
        : t({ ar: 'علّق', en: 'commented' });
  return (
    <li className={'event review ' + review.state}>
      <Avatar mark={by.mark} />
      <div className="ebody">
        <div className="ehead">
          <b>{by.name}</b> {verb}
        </div>
        <p>
          <Md text={t(review.body)} />
        </p>
        {review.comments.map((c, i) => (
          <div className="rcomment" key={i}>
            <div className="rfile mono" dir="ltr">
              {c.path}:{c.line}
            </div>
            <pre className="rcode" dir="ltr">
              <span className="ln">{c.line}</span>
              {lines(tree[c.path])[c.line - 1] ?? ''}
            </pre>
            <p>
              <Md text={t(c.body)} />
            </p>
          </div>
        ))}
      </div>
    </li>
  );
}

function Checks({ pr }: { pr: PullRequest }) {
  const game = useGame();
  const { t } = useLang();
  const checks = game.checks(pr);
  const ok = checks.every((c) => c.ok);
  return (
    <section className={'box checks ' + (ok ? 'ok' : 'fail')} id="prChecks">
      <h4>{ok ? t({ ar: 'كل الفحوصات نجحت', en: 'All checks have passed' }) : t({ ar: 'فيه فحص فاشل', en: 'Some checks were not successful' })}</h4>
      {checks.map((c) => (
        <details key={c.name} open={!c.ok}>
          <summary>
            <span className={'mark ' + (c.ok ? 'ok' : 'fail')} aria-hidden="true">
              {c.ok ? '✓' : '✕'}
            </span>
            <span className="mono" dir="ltr">
              {c.name}
            </span>
            <span className="muted">{c.ok ? t({ ar: 'نجح', en: 'Successful' }) : t({ ar: 'فشل', en: 'Failing' })}</span>
          </summary>
          <pre className="ciout" dir="ltr">
            {c.output.join('\n')}
          </pre>
        </details>
      ))}
    </section>
  );
}

function MergeBox({ pr }: { pr: PullRequest }) {
  const game = useGame();
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  if (pr.state === 'merged') {
    return (
      <section className="box merge done" id="mergeBox">
        <h4>{t({ ar: 'انْدمج الطلب', en: 'Pull request successfully merged' })}</h4>
        <p className="muted">
          <Md text={t({ ar: 'الشغل صار في `' + pr.base + '`.', en: 'The work is in `' + pr.base + '` now.' })} />
        </p>
      </section>
    );
  }
  const blockers = game.mergeBlockers(pr);
  const playing = game.session?.status === 'playing';
  return (
    <section className={'box merge ' + (blockers.length ? 'blocked' : 'ready')} id="mergeBox">
      {blockers.length ? (
        <>
          <h4>{t({ ar: 'الدمج مقفل', en: 'Merging is blocked' })}</h4>
          <ul>
            {blockers.map((b, i) => (
              <li key={i}>
                <Md text={t(b)} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h4>{t({ ar: 'جاهز للدمج', en: 'Ready to merge' })}</h4>
          <p className="muted">{t({ ar: 'موافقة المراجع موجودة، والفحوصات نجحت.', en: 'The review is approved and all checks passed.' })}</p>
        </>
      )}
      <div className="row">
        {confirming ? (
          <>
            <button
              type="button"
              className="btn primary"
              id="confirmMerge"
              onClick={() => {
                setConfirming(false);
                game.mergePull(pr.number);
              }}
            >
              {t({ ar: 'تأكيد الدمج', en: 'Confirm merge' })}
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
              {t({ ar: 'إلغاء', en: 'Cancel' })}
            </button>
          </>
        ) : (
          <button type="button" className="btn primary" id="mergePr" disabled={!!blockers.length || !playing} onClick={() => setConfirming(true)}>
            {t({ ar: 'ادمج الطلب', en: 'Merge pull request' })}
          </button>
        )}
      </div>
    </section>
  );
}
