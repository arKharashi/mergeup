import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Bilingual } from '../engine';
import { useGame } from './gameContext';
import { useLang } from './lang';
import { Md } from './Md';

const LEGEND: [kind: string, code: string, label: Bilingual][] = [
  ['modified', 'M', { ar: 'عدّلته وما جهّزته', en: 'changed, not staged' }],
  ['staged', 'M', { ar: 'جاهز للـ commit', en: 'staged' }],
  ['untracked', 'U', { ar: 'جديد', en: 'new' }],
  ['ignored', '!', { ar: 'متجاهَل', en: 'ignored' }],
];

/**
 * File list with git badges, and a plain editor. Saving writes to the working tree.
 * Give it key={session id} so a level load closes the editor.
 */
export function FilesPanel() {
  const game = useGame();
  const { t } = useLang();
  const local = game.session?.world.local;
  const files = game.files();
  const [open, setOpen] = useState<string | null>(null);
  /** The player's unsaved text. While null, the editor shows the file as it is now, so commands that change it show up. */
  const [draft, setDraft] = useState<string | null>(null);
  const [focusEditor, setFocusEditor] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState(false);

  // A command removed the open file.
  if (open && !files.some((f) => f.path === open)) {
    setOpen(null);
    setDraft(null);
  }

  const save = () => {
    if (!open) return;
    game.writeFile(open, draft ?? game.readFile(open) ?? '');
    setDraft(null);
  };

  const pick = (path: string) => {
    if (draft !== null) save();
    setOpen(path);
    setDraft(null);
    setFocusEditor(false);
  };

  const close = () => {
    if (draft !== null) save();
    setOpen(null);
  };

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };

  const stopCreating = () => {
    setCreating(false);
    setNewName('');
    setNewError(false);
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!game.createFile(name)) {
      setNewError(true);
      return;
    }
    stopCreating();
    setOpen(name);
    setDraft(null);
    setFocusEditor(true);
  };

  let editor;
  if (!local) {
    editor = (
      <div className="empty">
        <strong>{t({ ar: 'ما فيه ملفات للحين.', en: 'No files yet.' })}</strong>
        <span>
          <Md
            text={t({
              ar: 'المشروع عند الفريق، وأنت تحتاج نسخة منه. استخدم `git clone` في التيرمينال.',
              en: 'The project lives with the team, and you need a copy. Use `git clone` in the terminal.',
            })}
          />
        </span>
      </div>
    );
  } else if (!open) {
    editor = (
      <>
        <div className="empty">
          <span>{t({ ar: 'اختر ملف من القائمة تعدّله، أو أنشئ ملف جديد.', en: 'Pick a file from the list to edit it, or create a new one.' })}</span>
        </div>
        {creating ? (
          <form className="edfoot" id="newForm" onSubmit={create}>
            <input
              id="newName"
              placeholder={t({ ar: 'مثل: .gitignore', en: 'e.g. .gitignore' })}
              aria-label={t({ ar: 'اسم الملف الجديد', en: 'New file name' })}
              dir="ltr"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn primary">
              {t({ ar: 'إنشاء', en: 'Create' })}
            </button>
            <button type="button" className="btn ghost" id="newCancel" onClick={stopCreating}>
              {t({ ar: 'إلغاء', en: 'Cancel' })}
            </button>
            <span className="ederr" id="newError" hidden={!newError}>
              {t({ ar: 'اسم غير صالح: بدون مسافات أو مجلدات.', en: 'Invalid name: no spaces or folders.' })}
            </span>
          </form>
        ) : (
          <div className="edfoot">
            <button type="button" className="btn" id="newBtn" onClick={() => setCreating(true)}>
              {t({ ar: 'ملف جديد', en: 'New file' })}
            </button>
          </div>
        )}
        <div className="legend">
          {LEGEND.map(([kind, code, label]) => (
            <span key={kind}>
              <span className={'badge ' + kind}>{code}</span> {t(label)}
            </span>
          ))}
        </div>
      </>
    );
  } else {
    editor = (
      <>
        <div className="edhead">
          <span className="fname">{open}</span>
          <span className="dirty" id="edDirty" hidden={draft === null}>
            {t({ ar: 'تعديلات ما انحفظت', en: 'Unsaved changes' })}
          </span>
        </div>
        <textarea
          key={open}
          id="edText"
          dir="auto"
          spellCheck={false}
          aria-label={t({ ar: 'محتوى الملف', en: 'File contents' })}
          autoFocus={focusEditor}
          value={draft ?? game.readFile(open) ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onEditorKey}
        />
        <div className="edfoot">
          <button type="button" className="btn primary" id="edSave" onClick={save}>
            {t({ ar: 'حفظ', en: 'Save' })}
          </button>
          <button type="button" className="btn ghost" id="edClose" onClick={close}>
            {t({ ar: 'إغلاق', en: 'Close' })}
          </button>
          <span className="edkey">Ctrl/⌘ + S</span>
        </div>
      </>
    );
  }

  return (
    <section className="col col-files" aria-label={t({ ar: 'الملفات', en: 'Files' })}>
      <div className="col-head">
        <h2>{t({ ar: 'ملفات المشروع', en: 'Project files' })}</h2>
        <span className="mono" id="repoName">
          {local?.dir ?? ''}
        </span>
      </div>
      <ul className="files" id="files" hidden={!local}>
        {files.map((f) => (
          <li key={f.path}>
            <button type="button" aria-current={open === f.path ? 'true' : undefined} onClick={() => pick(f.path)}>
              <span>{f.path}</span>
              {f.badge && (
                <span className={'badge ' + f.badge.kind} title={t(f.badge.title)}>
                  {f.badge.code}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="editor" id="editor">
        {editor}
      </div>
    </section>
  );
}
